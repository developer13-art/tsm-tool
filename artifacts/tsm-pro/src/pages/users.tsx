import { ProtectedRoute, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { useListUsers, useCreateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { User, UserRole, UserInputRole } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Trash2, Shield, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useListUsers({
    query: {
      enabled: currentUser?.role === "admin"
    }
  });

  if (currentUser?.role !== "admin") {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-md mx-auto">
            <AlertTriangle className="w-16 h-16 text-destructive mb-6" />
            <h1 className="text-2xl font-bold tracking-tight mb-2">ACCESS DENIED</h1>
            <p className="text-muted-foreground font-mono">
              INSUFFICIENT CLEARANCE. THIS AREA REQUIRES ADMINISTRATOR PRIVILEGES.
            </p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Personnel Directory</h1>
              <p className="text-muted-foreground font-mono text-sm">OPERATOR CLEARANCE MANAGEMENT</p>
            </div>
            <CreateUserDialog />
          </div>

          <Card className="bg-card border-border">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />)}
              </div>
            ) : !users || users.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-mono">NO PERSONNEL FOUND</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Operator</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Comms Channel</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Clearance</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Provisioned</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <UserRow key={u.id} user={u} currentUserId={currentUser.id} />
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

function UserRow({ user, currentUserId }: { user: User, currentUserId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteUser();

  const isSelf = user.id === currentUserId;

  const handleDelete = () => {
    if (isSelf) {
      toast({ variant: "destructive", title: "Action Denied", description: "You cannot terminate your own session." });
      return;
    }
    if (confirm(`Revoke clearance for ${user.username}?`)) {
      deleteMutation.mutate({ id: user.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "Clearance Revoked", description: `${user.username} has been removed from the registry.` });
        }
      });
    }
  };

  return (
    <TableRow className="border-border hover:bg-secondary/50 group">
      <TableCell className="font-medium text-foreground">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-bold text-primary border border-border">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold">{user.username} {isSelf && <span className="text-muted-foreground text-xs font-normal">(YOU)</span>}</div>
            <div className="text-xs text-muted-foreground font-mono">ID: {user.id.toString().padStart(4, '0')}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`font-mono text-xs rounded-sm ${user.role === 'admin' ? 'border-primary text-primary bg-primary/10' : 'border-gray-500 text-gray-400 bg-gray-500/10'}`}>
          {user.role === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : null}
          {user.role.toUpperCase()}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {format(new Date(user.createdAt), "yyyy-MM-dd")}
      </TableCell>
      <TableCell className="text-right">
        {!isSelf && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleDelete} title="Revoke Clearance">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

const userSchema = z.object({
  username: z.string().min(3, "Required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 chars"),
  role: z.enum(["admin", "technician"]),
});

function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateUser();

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { username: "", email: "", password: "", role: "technician" }
  });

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "Personnel Provisioned", description: `Access granted for ${values.username}.` });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Provisioning Failed", description: "Username or email may exist." })
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> PROVISION OPERATOR
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> NEW CLEARANCE
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="username" render={({ field }) => (
              <FormItem><FormLabel className="font-mono text-xs">OPERATOR ID</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel className="font-mono text-xs">COMMS CHANNEL</FormLabel><FormControl><Input type="email" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem><FormLabel className="font-mono text-xs">INITIAL ACCESS CODE</FormLabel><FormControl><Input type="password" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs">CLEARANCE LEVEL</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger className="font-mono text-sm bg-secondary"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent className="bg-card">
                    <SelectItem value="technician" className="font-mono">TECHNICIAN</SelectItem>
                    <SelectItem value="admin" className="font-mono">ADMINISTRATOR</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="pt-6">
              <Button type="submit" disabled={createMutation.isPending} className="font-mono w-full font-bold">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> PROVISIONING...</> : "GRANT CLEARANCE"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}