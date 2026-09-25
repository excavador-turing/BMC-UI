import { createLazyFileRoute } from "@tanstack/react-router";

import CertificateCard from "@/components/CertificateCard";
import PasswordCard from "@/components/PasswordCard";
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
      {/* Split by subject: how people sign in, and which certificates the
          board presents and accepts. The trusted proxy is a certificate the
          board accepts, so it sits with the one it serves -- not under the
          password form, where it used to be. */}
      <PasswordCard />
      <CertificateCard />
    </TabView>
  );
}
