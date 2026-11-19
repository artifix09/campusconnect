import type { Metadata } from "next";
import { requirePageSession } from "@/lib/page-session";
import { formatDate, ROLE_LABEL } from "@/lib/format";
import { getProfile } from "@/modules/account/service";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { SecuritySettings } from "@/components/settings/security-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requirePageSession();
  const profile = await getProfile(session);

  return (
    <>
      <PageHeader title="Settings" description="Your profile, notifications and account security." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Profile" />
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{profile.name}</p>
              <p className="truncate text-sm text-muted">{profile.email}</p>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-line text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-muted">Role</dt>
              <dd className="font-medium text-ink">{ROLE_LABEL[profile.role]}</dd>
            </div>
            {profile.department ? (
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">Department</dt>
                <dd className="text-right font-medium text-ink">{profile.department.name}</dd>
              </div>
            ) : null}
            {profile.registrationNo ? (
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Registration no.</dt>
                <dd className="font-medium text-ink">{profile.registrationNo}</dd>
              </div>
            ) : null}
            <div className="flex justify-between py-2.5">
              <dt className="text-muted">Member since</dt>
              <dd className="font-medium text-ink">{formatDate(profile.createdAt)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted">To correct your name or registration number, contact the IT office.</p>
        </Card>

        <Card>
          <CardHeader title="Notifications" description="How we tell you about updates." />
          <PreferencesForm email={profile.emailNotifications} push={profile.pushNotifications} />
        </Card>

        <Card>
          <CardHeader title="Security" />
          <SecuritySettings staff={profile.role !== "STUDENT"} twoFactorEnabled={profile.setup.twoFactorEnabled} />
        </Card>
      </div>
    </>
  );
}
