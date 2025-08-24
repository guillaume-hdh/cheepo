import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import Home from "./pages/Home";
import Events from "./pages/Events";
import Profile from "./pages/Profile";
import EventDetail from "./pages/EventDetail";
import NotFound from "./pages/NotFound";
import AuthTest from "./pages/AuthTest";
import JoinByCode from "./pages/JoinByCode";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/events", element: <Events /> },
  { path: "/events/:id", element: <EventDetail /> },
  { path: "/profile", element: <Profile /> },
  { path: "*", element: <NotFound /> },
  { path: "/auth-test", element: <AuthTest /> },
  { path: "/join/:code", element: <JoinByCode /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
