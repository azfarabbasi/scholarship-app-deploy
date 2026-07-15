export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/workspace", label: "Workspace" },
  { href: "/calendar", label: "Calendar" },
  { href: "/settings", label: "Settings" },
];
