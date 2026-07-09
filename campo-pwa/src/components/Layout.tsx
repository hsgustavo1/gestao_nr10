import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SyncStatus } from "./SyncStatus";
import { startConnectivityWatcher } from "@/sync/engine";
import { cacheActor } from "@/lib/actor";
import { ensurePersistentStorage } from "@/lib/storage-health";

export default function Layout() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/login", { replace: true });
      else {
        setChecked(true);
        void cacheActor();
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (!checked) return;
    // Anti-eviction: pede ao SO para não apagar o IndexedDB sob pressão de storage
    // (spec cofre e portão §3.1). Resultado exibido no SyncStatus.
    void ensurePersistentStorage();
    return startConnectivityWatcher();
  }, [checked]);

  if (!checked) return null;

  return (
    <div className="flex flex-col min-h-dvh">
      <SyncStatus />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
