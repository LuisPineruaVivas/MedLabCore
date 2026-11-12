import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTurnstile } from "@/hooks/useTurnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, FlaskConical } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justConfirmed = searchParams.has("confirmado");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef<HTMLDivElement>(null);
  const captcha = useTurnstile(captchaRef);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captcha.required && !captcha.token) {
      toast.error("Espera un momento a que se complete la verificación de seguridad");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captcha.token ?? undefined },
    });
    setLoading(false);
    if (error) {
      captcha.reset();
      const msg = error.message || "Error de autenticación";
      if (msg.toLowerCase().includes("invalid login credentials") || msg.toLowerCase().includes("invalid email or password")) {
        toast.error("Usuario o contraseña inválidos");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        toast.error("Confirma tu correo antes de iniciar sesión: revisa el enlace que te enviamos.");
      } else if (msg.toLowerCase().includes("captcha")) {
        toast.error("La verificación de seguridad falló. Inténtalo de nuevo.");
      } else {
        toast.error(msg);
      }
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-24 h-24 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <img src="/logo.webp" alt="MedLabCore Logo" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl">Bienvenidos</CardTitle>
          <CardDescription>Inicia Sesion en tu cuenta</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {justConfirmed && (
              <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                ¡Correo confirmado! Tu prueba gratis de 7 días está activa. Inicia sesión para empezar.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)} 
                  required />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                   {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                </div>

            </div>
            <div ref={captchaRef} className="flex justify-center" />
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando Sesion..." : "Inicia Sesion"}
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿No tienes una cuenta?{" "}
              <Link to="/registro" className="text-primary hover:underline">Prueba gratis 7 días</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
