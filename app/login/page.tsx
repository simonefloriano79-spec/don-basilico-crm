"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import styles from "./login.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email) return;
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (res?.ok) {
      toast.success("Accesso effettuato!");
      router.push("/dashboard");
    } else {
      toast.error("Credenziali non valide");
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <img
              className={styles.logoImage}
              src="/brand/don-basilico-logo-header.png"
              alt="Don Basilico - Naturalmente Pizza"
            />
          </div>
          <div className={styles.logoSub}>Sistema Ordini</div>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="simone@donbasilico.it"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <button
            className={styles.btn}
            onClick={handleLogin}
            disabled={loading || !email}
          >
            {loading ? "Accesso in corso..." : "Accedi →"}
          </button>
        </div>

        <div className={styles.footer}>
          Don Basilico CRM v1.0 · Pitta srl
        </div>
      </div>
    </div>
  );
}
