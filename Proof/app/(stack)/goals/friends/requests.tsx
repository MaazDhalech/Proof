import { supabase } from "@/services/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type UserRequest = {
  id: string;
  name: string;
  username: string;
  user1_id: string;
  user2_id: string;
  direction: "incoming" | "outgoing";
};

type Profile = {
  first_name: string;
  last_name: string;
  username: string;
  id: string;
};

type FriendshipRecord = {
  user1_id: string;
  user2_id: string;
  requested_by: string;
  profile: Profile;
  profile2: Profile;
};

export default function FriendRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);

      if (uid) await fetchFriendRequests(uid);
    };

    init();
  }, []);

  const fetchFriendRequests = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("friends")
      .select(
        `
        user1_id,
        user2_id,
        requested_by,
        profile:profile!friends_user1_fkey (
          id,
          first_name,
          last_name,
          username
        ),
        profile2:profile!friends_user2_fkey (
          id,
          first_name,
          last_name,
          username
        )
      `
      )
      .eq("status", "pending")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`);

    if (error) {
      console.error("Error fetching friend requests:", error);
      setLoading(false);
      return;
    }

    const formatted: UserRequest[] = (data as any[]).map((req) => {
      // profile and profile2 are arrays, so take the first element
      const profile: Profile = Array.isArray(req.profile)
        ? req.profile[0]
        : req.profile;
      const profile2: Profile = Array.isArray(req.profile2)
        ? req.profile2[0]
        : req.profile2;
      const otherProfile = req.user1_id === uid ? profile2 : profile;
      const isOutgoing = req.requested_by === uid;

      return {
        id: otherProfile.id,
        name: `${otherProfile.first_name ?? ""} ${otherProfile.last_name ?? ""}`.trim(),
        username: otherProfile.username ?? "",
        user1_id: req.user1_id,
        user2_id: req.user2_id,
        direction: isOutgoing ? "outgoing" : "incoming",
      };
    });

    setRequests(formatted);
    setLoading(false);
  };

  const handleResponse = async (
    user1_id: string,
    user2_id: string,
    action: "accept" | "decline" | "cancel"
  ) => {
    if (!currentUserId || workingId) return;

    try {
      const compositeId =
        user1_id < user2_id
          ? `${user1_id}-${user2_id}`
          : `${user2_id}-${user1_id}`;
      setWorkingId(compositeId);

      if (action === "accept") {
        const { error } = await supabase
          .from("friends")
          .update({ status: "accepted" })
          .eq("user1_id", user1_id)
          .eq("user2_id", user2_id);
        if (error) {
          console.error("Accept request error:", error);
          return;
        }
      } else if (action === "decline" || action === "cancel") {
        const { error } = await supabase
          .from("friends")
          .delete()
          .eq("user1_id", user1_id)
          .eq("user2_id", user2_id);
        if (error) {
          console.error(
            `${action === "decline" ? "Decline" : "Cancel"} request error:`,
            error
          );
          return;
        }
      }

      setRequests((prev) =>
        prev.filter(
          (r) =>
            !(
              (r.user1_id === user1_id && r.user2_id === user2_id) ||
              (r.user1_id === user2_id && r.user2_id === user1_id)
            )
        )
      );
      await fetchFriendRequests(currentUserId!);
    } finally {
      setWorkingId(null);
    }
  };

  const getInitials = (name: string) => {
    if (!name || name.trim() === "") return "?";
    const words = name.trim().split(" ");
    return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
  };

  const renderRequest = ({ item }: { item: UserRequest }) => (
    <View style={styles.card}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.username}>
            @{item.username} •{" "}
            {item.direction === "incoming" ? "Incoming" : "Outgoing"} Request
          </Text>
        </View>
      </View>
      <View style={styles.buttonRow}>
        {item.direction === "incoming" ? (
          <>
            <TouchableOpacity
              style={[
                styles.button,
                styles.accept,
                workingId === `${item.user1_id}-${item.user2_id}` &&
                  styles.buttonDisabled,
              ]}
              disabled={!!workingId}
              onPress={() =>
                handleResponse(item.user1_id, item.user2_id, "accept")
              }
            >
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.decline,
                workingId === `${item.user1_id}-${item.user2_id}` &&
                  styles.buttonDisabled,
              ]}
              disabled={!!workingId}
              onPress={() =>
                handleResponse(item.user1_id, item.user2_id, "decline")
              }
            >
              <Text style={styles.buttonText}>Decline</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.button,
              styles.decline,
              workingId === `${item.user1_id}-${item.user2_id}` &&
                styles.buttonDisabled,
            ]}
            disabled={!!workingId}
            onPress={() =>
              handleResponse(item.user1_id, item.user2_id, "cancel")
            }
          >
            <Text style={styles.buttonText}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.push("/friends")}
        style={styles.backButton}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Friend Requests</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => `${item.user1_id}-${item.user2_id}`}
          renderItem={renderRequest}
          ListEmptyComponent={<Text>No pending requests.</Text>}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e1e3e6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: {
    color: "#0066ff",
    fontSize: 16,
    fontWeight: "600",
  },
  heading: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#111",
  },
  card: {
    backgroundColor: "#f1f1f1",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
  },
  username: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  button: {
    padding: 10,
    borderRadius: 6,
    marginHorizontal: 5,
    alignItems: "center",
    minWidth: 100,
  },
  accept: {
    backgroundColor: "#28a745",
  },
  decline: {
    backgroundColor: "#dc3545",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
