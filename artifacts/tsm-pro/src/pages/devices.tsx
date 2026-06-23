import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/lib/auth";
import { useListDevices, useScanDevices, useCreateDevice, useDeleteDevice, getListDevicesQueryKey } from "@workspace/api-client-react";
import { Device, DeviceStatus, DeviceMode, DeviceBootloaderStatus } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Power, RefreshCw, Smartphone, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

export default function Devices() {
  const { data: devices, isLoading } = useListDevices();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const scanMutation = useScanDevices();

  const handleScan = () => {
    scanMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        toast({ title: "Scan Complete", description: "Discovered devices added to registry." });
      },
      onError: () => toast({ variant: "destructive", title: "Scan Failed", description: "Could not complete network scan." })
    });
  };

  const filteredDevices = devices?.filter(d => 
    d.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Device Registry</h1>
              <p className="text-muted-foreground font-mono text-sm">MANAGE CONNECTED HARDWARE</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="secondary" onClick={handleScan} disabled={scanMutation.isPending} className="font-mono text-xs">
                <RefreshCw className={`w-4 h-4 mr-2 ${scanMutation.isPending ? "animate-spin" : ""}`} />
                {scanMutation.isPending ? "SCANNING..." : "SCAN NETWORK"}
              </Button>
              <CreateDeviceDialog />
            </div>
          </div>

          <Card className="bg-card border-border">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by serial or model..." 
                className="max-w-xs h-8 font-mono text-sm bg-secondary border-border"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />)}
              </div>
            ) : !filteredDevices || filteredDevices.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Smartphone className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-mono">NO DEVICES FOUND IN REGISTRY</p>
                <p className="text-sm mt-1">Run a network scan or add a device manually.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Serial / Model</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Chipset</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Status</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Mode</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Bootloader</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map(device => (
                    <DeviceRow key={device.id} device={device} />
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

function DeviceRow({ device }: { device: Device }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteDevice();
  const [, navigate] = useLocation();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove device ${device.serialNumber} from registry?`)) {
      deleteMutation.mutate({ id: device.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
          toast({ title: "Device removed", description: `${device.serialNumber} deleted.` });
        }
      });
    }
  };

  return (
    <TableRow
      className="border-border hover:bg-secondary/50 group cursor-pointer"
      onClick={() => navigate(`/devices/${device.id}`)}
    >
      <TableCell>
        <div className="font-mono font-medium text-foreground">{device.serialNumber}</div>
        <div className="text-xs text-muted-foreground">{device.brand} {device.model}</div>
      </TableCell>
      <TableCell className="font-mono text-sm">{device.chipset}</TableCell>
      <TableCell>
        <StatusBadge status={device.status} />
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/5 rounded-sm">
          {device.mode.toUpperCase()}
        </Badge>
      </TableCell>
      <TableCell>
        <BootloaderBadge status={device.bootloaderStatus} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Reboot" onClick={e => e.stopPropagation()}>
            <Power className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDelete} title="Remove">
            <Trash2 className="h-4 w-4" />
          </Button>
          <ChevronRight className="h-4 w-4 text-zinc-600 my-auto" />
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: string }) {
  let colorClass = "border-gray-500 text-gray-400 bg-gray-500/10";
  if (status === "online") colorClass = "border-green-500 text-green-400 bg-green-500/10";
  if (status === "busy") colorClass = "border-yellow-500 text-yellow-400 bg-yellow-500/10";
  if (status === "error") colorClass = "border-red-500 text-red-400 bg-red-500/10";

  return (
    <Badge variant="outline" className={`font-mono text-xs rounded-sm ${colorClass}`}>
      {status.toUpperCase()}
    </Badge>
  );
}

function BootloaderBadge({ status }: { status: string }) {
  let colorClass = "text-muted-foreground";
  if (status === "unlocked") colorClass = "text-green-500";
  if (status === "locked") colorClass = "text-yellow-500";

  return (
    <span className={`font-mono text-xs flex items-center gap-1.5 ${colorClass}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${status === 'unlocked' ? 'bg-green-500' : status === 'locked' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
      {status.toUpperCase()}
    </span>
  );
}

const deviceSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  model: z.string().min(1, "Model is required"),
  brand: z.string().min(1, "Brand is required"),
  chipset: z.string().min(1, "Chipset is required"),
});

function CreateDeviceDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateDevice();

  const form = useForm<z.infer<typeof deviceSchema>>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { serialNumber: "", model: "", brand: "", chipset: "" }
  });

  const onSubmit = (values: z.infer<typeof deviceSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        toast({ title: "Device Added", description: "Manual registration successful." });
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> ADD DEVICE
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono">MANUAL DEVICE REGISTRATION</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="serialNumber" render={({ field }) => (
              <FormItem><FormLabel className="font-mono text-xs">SERIAL NUMBER</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem><FormLabel className="font-mono text-xs">BRAND</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="model" render={({ field }) => (
                <FormItem><FormLabel className="font-mono text-xs">MODEL</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="chipset" render={({ field }) => (
              <FormItem><FormLabel className="font-mono text-xs">CHIPSET</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl></FormItem>
            )} />
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={createMutation.isPending} className="font-mono w-full">
                {createMutation.isPending ? "REGISTERING..." : "REGISTER DEVICE"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}