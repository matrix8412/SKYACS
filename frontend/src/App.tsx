import type { Component, ParentComponent } from 'solid-js';
import { lazy, Show } from 'solid-js';
import { Router, Route, Navigate } from '@solidjs/router';
import { AuthProvider, useAuth } from './lib/auth';
import { useTheme } from './lib/theme';
import Layout from './components/Layout';
import { FeedbackProvider } from './components/Feedback';
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Devices = lazy(() => import('./pages/Devices'));
const DeviceDetail = lazy(() => import('./pages/DeviceDetail'));
const Faults = lazy(() => import('./pages/Faults'));
const Firmwares = lazy(() => import('./pages/Firmwares'));
const Security = lazy(() => import('./pages/Security'));
const Settings = lazy(() => import('./pages/Settings'));
const Users = lazy(() => import('./pages/Users'));
const Delivery = lazy(() => import('./pages/Delivery'));
const Provisioning = lazy(() => import('./pages/Provisioning'));
const MetricsSettings = lazy(() => import('./pages/MetricsSettings'));

// Initialize theme on app load
useTheme();

const ProtectedLayout: ParentComponent = (props) => {
  const { isAuthenticated, ready } = useAuth();

  return (
    <Show when={ready()} fallback={<div class="app-loader"><span class="spinner" />Loading control plane…</div>}>
      <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
        <Layout>{props.children}</Layout>
      </Show>
    </Show>
  );
};

const App: Component = () => {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <Router>
          <Route path="/login" component={Login} />
          <Route path="/" component={ProtectedLayout}>
            <Route path="/" component={Dashboard} />
            <Route path="/devices" component={Devices} />
            <Route path="/device/:serial" component={DeviceDetail} />
            <Route path="/faults" component={Faults} />
            <Route path="/firmwares" component={Firmwares} />
            <Route path="/security" component={Security} />
            <Route path="/settings" component={Settings} />
            <Route path="/settings/users" component={Users} />
            <Route path="/settings/delivery" component={Delivery} />
            <Route path="/settings/provisioning" component={Provisioning} />
            <Route path="/settings/metrics" component={MetricsSettings} />
          </Route>
        </Router>
      </FeedbackProvider>
    </AuthProvider>
  );
};

export default App;
