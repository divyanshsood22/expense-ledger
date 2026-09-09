import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
                // Server save failed after the browser subscription was already
                // created — roll the browser side back too, so we never leave the
                // browser subscribed while push_subscriptions has no matching row.
                await unsubscribeFromPush().catch(() => {
                    // Best-effort cleanup: if this also fails, the subsequent status
                    // remains accurate to what's actually true below regardless.
                });
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
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {status === "unsupported" && (
                    <p className="text-sm text-muted-foreground">
                        Notifications aren't supported in this browser.
                    </p>
                )}

                {status === "ios-needs-install" && (
                    <p className="text-sm text-muted-foreground">
                        To get notifications on iPhone, add this app to your Home Screen first
                        (Share → Add to Home Screen), then open it from there. Notifications can't
                        be enabled from a regular Safari tab.
                    </p>
                )}

                {status === "denied" && (
                    <p className="text-sm text-muted-foreground">
                        Notifications are blocked for this site. Enable them in your browser or
                        device settings, then reload this page.
                    </p>
                )}

                {status === "enabled" && (
                    <>
                        <p className="text-sm text-muted-foreground">Notifications are enabled.</p>
                        <Button variant="outline" size="sm" onClick={handleDisable} disabled={isWorking}>
                            {isWorking ? "Disabling..." : "Disable notifications"}
                        </Button>
                    </>
                )}

                {status === "disabled" && (
                    <Button size="sm" onClick={handleEnable} disabled={isWorking}>
                        {isWorking ? "Enabling..." : "Enable notifications"}
                    </Button>
                )}

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}