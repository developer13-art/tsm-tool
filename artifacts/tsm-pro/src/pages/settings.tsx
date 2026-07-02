import { useState, useEffect } from "react";
import { ProtectedRoute, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Shield, LogOut, Key, Plus, Trash2, Copy, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface ApiToken {
  id: number;
  name: string;
  tokenMasked: string;
  tokenFull?: string;
  lastUsedAt: string | null;
  createdAt: string;
}

function TokenSection() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const loadTokens = async () => {
    const resp = await fetch("/api/tokens", { credentials: "include" });
    if (resp.ok) setTokens(await resp.json());
  };

  useEffect(() => { loadTokens(); }, []);

  const createToken = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const resp = await fetch("/api/tokens", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setFreshToken(data.tokenFull);
      setFreshId(data.id);
      setNewName("");
      await loadTokens();
    } catch {
      toast({ variant: "destructive", title: "Failed to create token" });
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: number) => {
    if (!confirm("Revoke this token? Any agent using it will stop working.")) return;
    await fetch(`/api/tokens/${id}`, { method: "DELETE", credentials: "include" });
    if (freshId === id) { setFreshToken(null); setFreshId(null); }
    await loadTokens();
    toast({ title: "Token revoked" });
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Token copied to clipboard" });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Key className="h-4 w-4" />
          API Tokens — Local Agent Auth
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-zinc-400">
          Generate tokens to authenticate the local agent. Each token is shown once — copy it immediately.
        </p>

        {/* New token input */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createToken()}
            placeholder="Token name (e.g. My PC Agent)"
            className="font-mono bg-secondary border-border text-sm flex-1"
          />
          <Button onClick={createToken} disabled={creating || !newName.trim()} className="font-mono text-xs shrink-0 bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
            <Plus className="w-4 h-4 mr-1" /> GENERATE
          </Button>
        </div>

        {/* Fresh token reveal */}
        {freshToken && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-sm font-medium text-emerald-300">Copy your token now — it won't be shown again</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-emerald-400 bg-zinc-900 rounded px-3 py-2 break-all border border-zinc-800">
                {freshToken}
              </code>
              <Button variant="ghost" size="sm" onClick={() => copyToken(freshToken)} className="shrink-0">
                {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Token list */}
        {tokens.length > 0 ? (
          <div className="space-y-2">
            {tokens.map(token => (
              <div key={token.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{token.name}</span>
                    {freshId === token.id && <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[10px]">NEW</Badge>}
                  </div>
                  <code className="text-[11px] font-mono text-zinc-500">{token.tokenMasked}</code>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    Created {format(new Date(token.createdAt), "MMM d, yyyy")}
                    {token.lastUsedAt && ` · Last used ${format(new Date(token.lastUsedAt), "MMM d")}`}
                  </p>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => revokeToken(token.id)}
                  className="shrink-0 h-8 w-8 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600 font-mono text-center py-4">NO TOKENS — Generate one to connect the local agent</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
            <p className="text-muted-foreground font-mono text-sm">OPERATOR CONFIGURATION</p>
          </div>

          <div className="max-w-2xl space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Operator Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-lg bg-secondary border border-border flex items-center justify-center text-4xl font-bold text-primary">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">{user?.username}</h2>
                    <p className="text-muted-foreground font-mono">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Shield className={`w-4 h-4 ${user?.role === 'admin' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-mono uppercase border border-border px-2 py-0.5 rounded bg-secondary">
                        {user?.role} CLEARANCE
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <h3 className="font-mono text-sm mb-4">SESSION MANAGEMENT</h3>
                  <Button variant="destructive" onClick={logout} className="font-mono">
                    <LogOut className="w-4 h-4 mr-2" />
                    TERMINATE SESSION
                  </Button>
                </div>
              </CardContent>
            </Card>

            <TokenSection />
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
