import { useNavigate } from "@tanstack/react-router";

import { ScoutLogo } from "./ScoutLogo";
import { useAuth } from "../lib/auth";
import { resolvePostLoginRoute } from "../lib/auth";
import { cn } from "../lib/utils";

export function ScoutLogoLink({ className }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleClick = async () => {
    // Not authenticated → landing page.
    if (!user?.id) {
      navigate({ to: "/" });
      return;
    }
    // Authenticated → feed if onboarding complete, otherwise onboarding.
    const dest = await resolvePostLoginRoute(user.id);
    navigate({ to: dest });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn("flex items-center", className)}
      aria-label="Scout home"
    >
      <ScoutLogo />
    </button>
  );
}
