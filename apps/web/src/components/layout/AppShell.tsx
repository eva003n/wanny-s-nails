import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import OfflineBanner from "@/components/layout/OfflineBanner";
import ToastContainer from "@/components/ui/Toast";
import { useSSE } from "@/hooks/useSSE";

export default function AppShell() {
  useSSE();

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <OfflineBanner />
        <main className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <ToastContainer />
    </div>
  );
}
