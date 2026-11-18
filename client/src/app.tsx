import { createBrowserRouter, RouterProvider } from "react-router-dom";

import ShowcasePage from "@/pages/showcase-page";

const router = createBrowserRouter([
  { path: "/", element: <ShowcasePage /> },
  { path: "*", element: <ShowcasePage /> },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
