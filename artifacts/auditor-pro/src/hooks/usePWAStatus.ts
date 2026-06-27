import { useEffect, useState } from "react";

type PWAStatus = "checking" | "ready" | "installing" | "unsupported";

export function usePWAStatus(): PWAStatus {
  const [status, setStatus] = useState<PWAStatus>("checking");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }

    const check = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          setStatus("installing");
          return;
        }
        if (reg.installing || reg.waiting) {
          setStatus("installing");
        } else if (reg.active) {
          setStatus("ready");
        } else {
          setStatus("installing");
        }
      } catch {
        setStatus("unsupported");
      }
    };

    check();

    const onControllerChange = () => setStatus("ready");
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker.ready.then(() => setStatus("ready")).catch(() => {});

    const onUpdateFound = () => setStatus("installing");
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.addEventListener("updatefound", onUpdateFound);
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return status;
}
