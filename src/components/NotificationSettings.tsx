import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { savePushSubscription, removePushSubscription, ApiError } from "@/lib/api";
import {
  isPushSupported,
  needsIOSInstall,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

type Status = "checking" | "unsupported" | "ios-needs-install" | "denied" | "enabled" | "disabled";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

export default function NotificationSettings() {
  const [status, setStatus] = useState<Status>("checking");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function determineStatus() {
      if (!isPushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (needsIOSInstall()) {
        if (!cancelled) setStatus("ios-needs-install");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      const existing = await getExistingSubscription();
      if (!cancelled) setStatus(existing ? "enabled" : "disabled");
    }

    determineStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setError(null);
    setIsWorking(true);
    try {
      const keys = await subscribeToPush(VAPID_PUBLIC_KEY);

      try {
        await savePushSubscription(keys);
        setStatus("enabled");
      } catch (saveErr) {
        await unsubscribeFromPush().catch(() => {});
        setStatus("disabled");
        setError(
          saveErr instanceof ApiError
            ? "Subscribed, but couldn't save it to your account. Try again."
            : "Couldn't enable notifications. Try again.",
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message === "denied") {
        setStatus("denied");
      } else {
        setError("Couldn't enable notifications. Try again.");
      }
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setIsWorking(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) {
        await removePushSubscription(endpoint);
      }
      setStatus("disabled");
    } catch {
      setError("Couldn't disable notifications. Try again.");
    } finally {
      setIsWorking(false);
    }
  }

  if (status === "checking") return null;

  return (
    <section className="flex items-start justify-between gap-4 border-t border-border pt-6 text-sm">
      <div>
        <p className="text-muted-foreground">Notifications</p>

        {status === "unsupported" && (
          <p className="mt-1 text-muted-foreground/80">Not supported in this browser.</p>
        )}
        {status === "ios-needs-install" && (
          <p className="mt-1 max-w-sm text-muted-foreground/80">
            Add this app to your Home Screen (Share → Add to Home Screen) to enable
            notifications on iPhone.
          </p>
        )}
        {status === "denied" && (
          <p className="mt-1 text-muted-foreground/80">
            Blocked — enable in your browser settings, then reload.
          </p>
        )}
        {status === "enabled" && <p className="mt-1 text-foreground">Enabled</p>}
        {status === "disabled" && <p className="mt-1 text-muted-foreground/80">Off</p>}

        {error && (
          <p role="alert" className="mt-1 text-destructive">
            {error}
          </p>
        )}
      </div>

      {(status === "enabled" || status === "disabled") && (
        <Button
          variant={status === "enabled" ? "outline" : "default"}
          size="sm"
          onClick={status === "enabled" ? handleDisable : handleEnable}
          disabled={isWorking}
        >
          {isWorking ? "…" : status === "enabled" ? "Disable" : "Enable"}
        </Button>
      )}
    </section>
  );
}