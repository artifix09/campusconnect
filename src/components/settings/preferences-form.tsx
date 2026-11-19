"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { FormMessage } from "@/components/ui/field";
import { disablePush, enablePush } from "@/components/notifications/push";
import { usePushSupport } from "@/lib/use-browser";
import { Toggle } from "./toggle";

export function PreferencesForm({ email, push }: { email: boolean; push: boolean }) {
  const [prefs, setPrefs] = useState({ emailNotifications: email, pushNotifications: push });
  const device = usePushSupport();
  const [deviceOn, setDeviceOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (device !== "granted") return;
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setDeviceOn(Boolean(s)))
      .catch(() => setDeviceOn(false));
  }, [device]);

  async function save(next: typeof prefs) {
    const previous = prefs;
    setPrefs(next);
    setSaving(true);
    setError(null);
    try {
      await api("/api/v1/me/preferences", { method: "PATCH", body: next });
    } catch (err) {
      setPrefs(previous);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="divide-y divide-line">
      {error ? <div className="pb-3"><FormMessage>{error}</FormMessage></div> : null}
      <Toggle
        label="Email updates"
        description="Status changes and replies, sent to your university inbox."
        checked={prefs.emailNotifications}
        disabled={saving}
        onChange={(v) => save({ ...prefs, emailNotifications: v })}
      />
      <Toggle
        label="Push notifications"
        description="Allow push notifications on your devices."
        checked={prefs.pushNotifications}
        disabled={saving}
        onChange={(v) => save({ ...prefs, pushNotifications: v })}
      />
      {device !== "unsupported" ? (
        <Toggle
          label="This device"
          description={
            device === "denied"
              ? "Blocked in your browser settings. Allow notifications for this site to turn it on."
              : "Receive push notifications on this phone or computer."
          }
          checked={deviceOn}
          disabled={device === "denied" || !prefs.pushNotifications}
          onChange={async (v) => {
            if (v) setDeviceOn(await enablePush());
            else {
              await disablePush();
              setDeviceOn(false);
            }
          }}
        />
      ) : (
        <p className="py-3 text-sm text-muted">
          Push notifications are not available in this browser. On iPhone, install the app to your home screen first.
        </p>
      )}
    </div>
  );
}
