import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const signupSchema = z.object({
  labName: z.string().trim().min(2, "Escribe el nombre de tu laboratorio").max(120),
  fullName: z.string().trim().min(2, "Escribe tu nombre").max(120),
  phone: z.string().trim().min(7, "Escribe un teléfono de contacto").max(30),
  email: z.string().trim().email("Escribe un correo válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

type SignupForm = z.infer<typeof signupSchema>;
type FieldErrors = Partial<Record<keyof SignupForm, string>>;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: { sitekey: string; language?: string; callback: (token: string) => void; "expired-callback": () => void }) => string;
      reset: (widgetId: string) => void;
    };
  }
}

/** Cloudflare Turnstile captcha; Supabase Auth checks the token. Without a site key (local dev) it renders nothing. */
function useTurnstile(container: React.RefObject<HTMLDivElement>) {
  const [token, setToken] = useState<string | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !container.current) return;
    const render = () => {
      if (!window.turnstile || !container.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language: "es",
        callback: setToken,
        "expired-callback": () => setToken(null),
      });
    };
    if (window.turnstile) return render();
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [container]);

  const reset = () => {
    setToken(null);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  };

  return { token, required: Boolean(TURNSTILE_SITE_KEY), reset };
}

export default function SignupPage() {
  const [form, setForm] = useState<SignupForm>({ labName: "", fullName: "", phone: "", email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const captcha = useTurnstile(captchaRef);

  const set = (field: keyof SignupForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])) as FieldErrors);
      return;
    }
    setErrors({});
    if (captcha.required && !captcha.token) {
      toast.error("Completa la verificación de seguridad");
      return;
    }

    setLoading(true);
    const { labName, fullName, phone, email, password } = parsed.data;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The lab is created when the email is confirmed (trigger handle_trial_signup_confirmed).
        data: { full_name: fullName, lab_name: labName, phone, signup: "trial" },
        captchaToken: captcha.token ?? undefined,
        emailRedirectTo: `${window.location.origin}/login?confirmado=1`,
      },
    });
    setLoading(false);

    if (error) {
      captcha.reset();
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered")) toast.error("Ya existe una cuenta con ese correo. Inicia sesión.");
      else if (msg.includes("password")) toast.error("Elige una contraseña más segura (al menos 8 caracteres, con letras y números).");
      else if (msg.includes("captcha")) toast.error("La verificación de seguridad falló. Inténtalo de nuevo.");
      else if (msg.includes("rate limit")) toast.error("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
      else toast.error("No se pudo crear la cuenta. Inténtalo de nuevo.");
      return;
    }
    // Supabase answers the same way when the email is already registered, so the message stays neutral.
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Revisa tu correo</CardTitle>
            <CardDescription>
              Te enviamos un enlace a <strong>{sentTo}</strong> para confirmar tu cuenta. Al confirmarla se activa tu prueba
              gratis de 7 días y ya puedes iniciar sesión.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col gap-2">
            <p className="text-xs text-muted-foreground">¿No te llegó? Revisa la carpeta de spam o promociones.</p>
            <Link to="/login" className="text-sm text-primary hover:underline">
              Ir a iniciar sesión
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const field = (id: keyof SignupForm, label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={form[id]} onChange={set(id)} aria-invalid={Boolean(errors[id])} {...props} />
      {errors[id] && <p className="text-sm text-destructive">{errors[id]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <img src="/logo.webp" alt="MedLabCore Logo" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl">Prueba MedLabCore gratis</CardTitle>
          <CardDescription>7 días con todas las funciones, sin tarjeta.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup} noValidate>
          <CardContent className="space-y-4">
            {field("labName", "Nombre del laboratorio", { placeholder: "Laboratorio Clínico San José", autoComplete: "organization" })}
            {field("fullName", "Tu nombre", { placeholder: "Ana Pérez", autoComplete: "name" })}
            {field("phone", "Teléfono", { placeholder: "0414 123 4567", type: "tel", autoComplete: "tel" })}
            {field("email", "Correo", { placeholder: "tu@laboratorio.com", type: "email", autoComplete: "email" })}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set("password")}
                  aria-invalid={Boolean(errors.password)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>
            <div ref={captchaRef} className="flex justify-center" />
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando tu cuenta..." : "Comenzar prueba gratis"}
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Inicia sesión
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
