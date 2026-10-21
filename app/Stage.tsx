"use client";
import { useEffect, useRef } from "react";

/** Scène 3D d'ouverture : le colis tombe, le client confirme sur WhatsApp, le tampon s'applique.
 *  Ensuite le colis suit le pointeur (ou l'inclinaison au toucher). */
export default function Stage() {
  const tilt = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = tilt.current;
    if (!el) return;
    const move = (x: number, y: number) => {
      const rx = (0.5 - y / window.innerHeight) * 18;
      const ry = (x / window.innerWidth - 0.5) * 28;
      el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    const onMouse = (e: PointerEvent) => move(e.clientX, e.clientY);
    window.addEventListener("pointermove", onMouse, { passive: true });
    return () => window.removeEventListener("pointermove", onMouse);
  }, []);

  return (
    <div className="stage" aria-hidden="true">
      <div className="floor" />
      <div className="bubble b1">Salam Imane 👋 Tlbti « Robe caftan » b 420 DH. Jawb b 1 bach tconfirmi.<small>10:42</small></div>
      <div className="bubble b2">1 ✅<small>10:43</small></div>
      <div className="risk-chip"><i />RISQUE 0/100</div>
      <div ref={tilt} className="tilt">
        <div className="parcel">
          <div className="f front">
            <div className="label"><b>CM-1042</b>Casablanca<br />COD 420 DH</div>
            <div className="stamp">CONFIRMÉE</div>
          </div>
          <div className="f back" /><div className="f right" /><div className="f left" /><div className="f top" /><div className="f bottom" />
        </div>
      </div>
    </div>
  );
}
