import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./index.css";
import "./theme.css";

import AdminRoute from "./components/AdminRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import NotFoundPage from "./pages/NotFoundPage";
import JoinByCodePage from "./pages/JoinByCodePage";
import SuperAdminPage from "./pages/SuperAdminPage";
import { SessionProvider } from "./lib/session";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/auth", element: <Auth /> },
  {
    path: "/events",
    element: (
      <ProtectedRoute>
        <EventsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/events/:eventId",
    element: (
      <ProtectedRoute>
        <EventDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <SuperAdminPage />
      </AdminRoute>
    ),
  },
  { path: "/join/:code", element: <JoinByCodePage /> },
  { path: "*", element: <NotFoundPage /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </React.StrictMode>
);
