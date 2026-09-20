import { createLazyFileRoute } from "@tanstack/react-router";

import AccessCard from "@/components/AccessCard";
import CertificateCard from "@/components/CertificateCard";
import HostnameCard from "@/components/HostnameCard";
import InfoSkeleton from "@/components/skeletons/info";
import TabView from "@/components/TabView";

export const Route = createLazyFileRoute("/_tabLayout/access")({
  component: Access,
  errorComponent: () => <div>Error loading Access</div>,
  pendingComponent: InfoSkeleton,
});

/**
 * What this board is called, and who may reach it.
 *
 * Settings had grown to seven cards answering three unrelated questions, and
 * was 3014 px at 1280×800 — four screens. These three belong together and
 * apart from the rest: the name is how a certificate is checked and how a
 * person finds the board, the password and the trusted proxy are who may get
 * in, and the certificate is what the board proves itself with. Reading one
 * of them usually means reading the next.
 *
 * "Security" was considered and rejected. A hostname is not a security
 * setting, and a tab whose name is wrong for a quarter of what it holds is a
 * tab people do not look in.
 */
export function Access() {
  return (
    <TabView>
      <HostnameCard />
      <AccessCard />
      {/* Beside the access card, because both answer "who can reach this
          board and on what terms" -- and because the trust anchor above and
          the certificate here are the two halves people confuse. */}
      <CertificateCard />
    </TabView>
  );
}
