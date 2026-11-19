import {
  ChartColumn,
  Bell,
  ClipboardList,
  CircleHelp,
  LayoutGrid,
  CirclePlus,
  Route,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/domain/types";

export type NavItem = { href: string; label: string; icon: LucideIcon; badgeKey?: "notifications" | "queue"; exact?: boolean };

export function homeFor(role: Role) {
  return role === "STUDENT" ? "/student" : "/admin";
}

export function menuFor(role: Role): NavItem[] {
  if (role === "STUDENT") {
    return [
      { href: "/student", label: "Dashboard", icon: LayoutGrid, exact: true },
      { href: "/student/complaints", label: "My complaints", icon: ClipboardList },
      { href: "/student/complaints/new", label: "New complaint", icon: CirclePlus, exact: true },
      { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
    ];
  }
  const items: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
    { href: "/admin/complaints", label: "Complaints", icon: ClipboardList, badgeKey: "queue" },
    { href: "/admin/analytics", label: "Analytics", icon: ChartColumn },
    { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  ];
  if (role === "SUPER_ADMIN") {
    items.push(
      { href: "/admin/users", label: "Staff & users", icon: Users },
      { href: "/admin/categories", label: "Routing", icon: Route },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    );
  }
  return items;
}

export const GENERAL: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: CircleHelp },
];

/** At most five destinations on the phone tab bar. */
export function bottomNavFor(role: Role): NavItem[] {
  if (role === "STUDENT") {
    return [
      { href: "/student", label: "Home", icon: LayoutGrid, exact: true },
      { href: "/student/complaints", label: "Complaints", icon: ClipboardList },
      { href: "/student/complaints/new", label: "New", icon: CirclePlus, exact: true },
      { href: "/notifications", label: "Alerts", icon: Bell, badgeKey: "notifications" },
      { href: "/settings", label: "Profile", icon: Settings },
    ];
  }
  return [
    { href: "/admin", label: "Home", icon: LayoutGrid, exact: true },
    { href: "/admin/complaints", label: "Queue", icon: ClipboardList, badgeKey: "queue" },
    { href: "/admin/analytics", label: "Analytics", icon: ChartColumn },
    { href: "/notifications", label: "Alerts", icon: Bell, badgeKey: "notifications" },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
}

export function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
