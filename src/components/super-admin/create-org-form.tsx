"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { createOrganization } from "@/lib/actions/super-admin";
import { isValidEmail, normalizeEmail } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [tempPassword, setTempPassword] = useState(generatePassword);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !adminEmail.trim() || !tempPassword) return;
    if (!isValidEmail(adminEmail)) {
      toast.error("Invalid email address", {
        description: "Please enter a valid admin email address.",
      });
      return;
    }

    setLoading(true);
    try {
      const { org } = await createOrganization(name.trim(), normalizeEmail(adminEmail), tempPassword);
      toast.success(`"${org.name}" created. Share the credentials with the admin.`);
      router.push("/super-admin/organizations");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Organization name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Construction"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Admin email</Label>
        <Input
          id="email"
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder="admin@acme.com"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Temporary password</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              required
              disabled={loading}
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setTempPassword(generatePassword())}
            title="Generate new password"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Share this with the admin. They will be asked to change it on first login.
        </p>
      </div>

      <Button type="submit" disabled={loading || !name.trim() || !adminEmail.trim() || !tempPassword}>
        {loading ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
