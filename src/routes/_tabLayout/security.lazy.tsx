import { createLazyFileRoute } from "@tanstack/react-router";

import AccessCard from "@/components/AccessCard";
import CertificateCard from "@/components/CertificateCard";
import InfoSkeleton from "@/components/skeletons/info";
import TabView from "@/components/TabView";

export const Route = createLazyFileRoute("/_tabLayout/security")({
  component: Security,
  errorComponent: () => <div>Error loading Security</div>,
  pendingComponent: InfoSkeleton,
});

/**
 * Who may reach this board, and what it proves itself with.
 *
 * Settings had grown to seven cards answering three unrelated questions and
 * was 3014 px at 1280×800 — four screens. What is here is one question: the
 * password and the trusted proxy are who may get in, and the certificate is
 * what the board proves itself with. Reading one usually means reading the
 * other.
 *
 * It was called **Access** for one release, because it also held the
 * hostname and a hostname is not a security setting, so "Security" would
 * have been wrong for a third of the tab. The hostname has gone to Network,
 * where it belongs — it is how you reach the board, it is in the
 * certificate's names, it is the mDNS name — and with it gone the honest
 * name for what is left is Security.
 */
export function Security() {
  return (
    <TabView columns>
      <AccessCard />
      {/* Beside the access card, because both answer "who can reach this
          board and on what terms" -- and because the trust anchor there and
          the certificate here are the two halves people confuse. */}
      <CertificateCard />
    </TabView>
  );
}
