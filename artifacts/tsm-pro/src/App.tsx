import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";

import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Devices from "@/pages/devices";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import Console from "@/pages/console";
import UsersPage from "@/pages/users";
import Settings from "@/pages/settings";
import Agent from "@/pages/agent";
import DeviceDetail from "@/pages/device-detail";
import Guide from "@/pages/guide";
import Wizard from "@/pages/wizard";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Switch>
              <Route path="/login" component={Login} />
              <Route path="/register" component={Register} />
              <Route path="/" component={Dashboard} />
              <Route path="/devices" component={Devices} />
              <Route path="/devices/:id" component={DeviceDetail} />
              <Route path="/jobs" component={Jobs} />
              <Route path="/jobs/:id" component={JobDetail} />
              <Route path="/console" component={Console} />
              <Route path="/users" component={UsersPage} />
              <Route path="/settings" component={Settings} />
              <Route path="/agent" component={Agent} />
              <Route path="/guide" component={Guide} />
              <Route path="/wizard" component={Wizard} />
              <Route component={NotFound} />
            </Switch>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;