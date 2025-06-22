import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  PanResponder,
  Keyboard,
  SafeAreaView,
} from 'react-native';
import { supabase } from '@/services/supabase';
import Constants from 'expo-constants';
import { letta_client } from '@/services/letta';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

const {
  LETTA_CHATBOT_MODEL,
} = Constants.expoConfig?.extra || {};

// Types
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatbotProps {
  userId?: string;
}

// Letta Agent Service
class LettaService {
  private messages: Array<{ role: string; content: string }> = [
    { role: "system", content: "You are a helpful assistant for a goal-tracking app. Help users with their goals, provide motivation, and answer questions about their progress." }
  ];

  async chatWithAgent(userInput: string): Promise<string> {
    try {
      // Add user message to conversation history
    //   this.messages.push({ role: "user", content: userInput });

      // Check if we have the required API keys
      if (!LETTA_CHATBOT_MODEL) {
        console.warn('Letta API keys not configured, using fallback response');
        return "Hello! I'm your goal assistant. How can I help you with your goals today?";
      }

      const response = await letta_client.agents.messages.create(LETTA_CHATBOT_MODEL,{
        messages: [{
			role: "user",
			content: [{
            type: "text",
            text: userInput
          }]
		}],
      });

      console.log('Letta response:', response);
      const agentReply = response.messages[1].content;
     
      // Add agent reply to conversation history
    //   this.messages.push({ role: "assistant", content: agentReply });
     
      return agentReply;
    } catch (error) {
      console.error('Error communicating with Letta agent:', error);
      return "I'm sorry, I'm having trouble responding right now. Please try again later.";
    }
  }
}

const lettaService = new LettaService();

function Chatbot({ userId }: ChatbotProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
 
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);
  const translateY = useRef(new Animated.Value(0)).current;

  // Keyboard listeners
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Pan responder for drag to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate if dragging vertically from the top area and keyboard is not open
        return keyboardHeight === 0 && Math.abs(gestureState.dy) > 10 && evt.nativeEvent.pageY < 150;
      },
      onPanResponderGrant: () => {
        translateY.setOffset(0);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow downward movement
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        translateY.flattenOffset();
        
        // If dragged down more than 100px or with high velocity, close modal
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setIsVisible(false);
            translateY.setValue(0);
          });
        } else {
          // Spring back to original position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Animate chat bubble button
  useEffect(() => {
    if (hasNewMessage) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [hasNewMessage]);

  // Load chat history from Supabase
  const loadChatHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, get or create a chat for this user
      let { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('user_id', user.id)
        .single();

      let chatId;
      if (chatError || !existingChat) {
        // Create a new chat if none exists
        const { data: newChat, error: createError } = await supabase
          .from('chats')
          .insert({ user_id: user.id })
          .select('id')
          .single();
       
        if (createError) {
          console.error('Error creating chat:', createError);
          return;
        }
        chatId = newChat.id;
      } else {
        chatId = existingChat.id;
      }

      // Load messages for this chat
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
        return;
      }

      if (data) {
        const formattedMessages: Message[] = data.map(msg => ({
          id: msg.id,
          content: msg.message,
          role: msg.sender_type === 'bot' ? 'assistant' : 'user',
          timestamp: new Date(msg.created_at),
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  // Save message to Supabase
  const saveMessage = async (content: string, senderType: 'user' | 'bot') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get or create chat
      let { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('user_id', user.id)
        .single();

      let chatId;
      if (chatError || !existingChat) {
        const { data: newChat, error: createError } = await supabase
          .from('chats')
          .insert({ user_id: user.id })
          .select('id')
          .single();
       
        if (createError) {
          console.error('Error creating chat:', createError);
          return null;
        }
        chatId = newChat.id;
      } else {
        chatId = existingChat.id;
      }

      // Save the message
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          user_id: user.id,
          sender_type: senderType,
          message: content,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving message:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  };

  // Handle opening chat
  const handleOpenChat = () => {
    setIsVisible(true);
    setHasNewMessage(false);
    translateY.setValue(0); // Reset position
    if (messages.length === 0) {
      loadChatHistory();
    }
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Save user message to Supabase
    await saveMessage(userMessage.content, 'user');

    try {
      // Get response from Letta agent
      const agentResponse = await lettaService.chatWithAgent(userMessage.content);
     
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: agentResponse,
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
     
      // Save assistant message to Supabase
      await saveMessage(assistantMessage.content, 'bot');

    } catch (error) {
      console.error('Error getting agent response:', error);
      Alert.alert('Error', 'Failed to get response from assistant');
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Render individual message
  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.role === 'user' ? styles.userMessage : styles.assistantMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.role === 'user' ? styles.userMessageText : styles.assistantMessageText
      ]}>
        {item.content}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  // Calculate dynamic heights
  const modalHeight = keyboardHeight > 0 
  ? screenHeight - keyboardHeight - (Platform.OS === 'ios' ? 0 : 0)
  : screenHeight * 0.5; // Reduced from 0.75 to 0.5

  return (
    <>
      {/* Chat Bubble Button */}
      <TouchableOpacity
        style={styles.chatButton}
        onPress={handleOpenChat}
        activeOpacity={0.8}
      >
        <Animated.View style={{
          transform: [
            { scale: scaleAnim },
            { scale: pulseAnim }
          ]
        }}>
          <Text style={styles.chatButtonText}>💬</Text>
          {hasNewMessage && <View style={styles.notificationDot} />}
        </Animated.View>
      </TouchableOpacity>

      {/* Chat Modal */}
      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsVisible(false)}
        presentationStyle="overFullScreen"
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <Animated.View 
              style={[
                styles.chatContainer,
                {
                  height: modalHeight,
                  transform: [{ translateY: translateY }]
                }
              ]}
              {...(keyboardHeight === 0 ? panResponder.panHandlers : {})}
            >
              {/* Drag Handle - only show when keyboard is closed */}
              {keyboardHeight === 0 && <View style={styles.dragHandle} />}
              
              {/* Header */}
              <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>Goal Assistant</Text>
                <TouchableOpacity
                  onPress={() => setIsVisible(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Messages */}
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />

              {/* Loading indicator */}
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Assistant is typing...</Text>
                </View>
              )}

              {/* Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask me about your goals..."
                  placeholderTextColor="#999"
                  multiline
                  maxLength={500}
                  returnKeyType="send"
                  onSubmitEditing={handleSendMessage}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!inputText.trim() || isLoading) && styles.sendButtonDisabled
                  ]}
                  onPress={handleSendMessage}
                  disabled={!inputText.trim() || isLoading}
                >
                  <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chatButton: {
    position: 'absolute',
    bottom: 140, // Above tab bar
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  chatButtonText: {
    fontSize: 24,
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chatContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    // Reduced height - was screenHeight * 0.75, now much smaller
    maxHeight: screenHeight * 0.5, // 50% of screen instead of 75%
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8, // Reduced from 12
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10, // Reduced from 15
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chatTitle: {
    fontSize: 16, // Reduced from 18
    fontWeight: 'bold',
    color: '#111',
  },
  closeButton: {
    width: 28, // Reduced from 30
    height: 28, // Reduced from 30
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14, // Reduced from 16
    color: '#666',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16, // Reduced from 20
    maxHeight: screenHeight * 0.3, // Limit messages area height
  },
  messagesContent: {
    paddingVertical: 8, // Reduced from 10
    flexGrow: 1,
  },
  messageContainer: {
    marginVertical: 3, // Reduced from 5
    maxWidth: '80%',
    padding: 10, // Reduced from 12
    borderRadius: 12, // Reduced from 15
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007aff',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 14, // Reduced from 16
    lineHeight: 18, // Reduced from 20
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#111',
  },
  timestamp: {
    fontSize: 11, // Reduced from 12
    color: '#999',
    marginTop: 3, // Reduced from 4
  },
  loadingContainer: {
    paddingHorizontal: 16, // Reduced from 20
    paddingVertical: 6, // Reduced from 10
    alignItems: 'flex-start',
  },
  loadingText: {
    fontSize: 13, // Reduced from 14
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16, // Reduced from 20
    paddingTop: 12, // Reduced from 15
    paddingBottom: Platform.OS === 'ios' ? 16 : 12, // Reduced
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    minHeight: 60, // Reduced from 70
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 18, // Reduced from 20
    paddingHorizontal: 12, // Reduced from 15
    paddingVertical: 8, // Reduced from 12
    marginRight: 8, // Reduced from 10
    maxHeight: 70, // Keep same
    minHeight: 36, // Reduced from 40
    fontSize: 14, // Reduced from 16
    backgroundColor: '#fff',
    textAlignVertical: 'center',
  },
  sendButton: {
    backgroundColor: '#007aff',
    paddingHorizontal: 16, // Reduced from 20
    paddingVertical: 8, // Reduced from 12
    borderRadius: 18, // Reduced from 20
    minHeight: 36, // Reduced from 40
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14, // Reduced from 16
  },
});

// Make sure to export as default
export default Chatbot;