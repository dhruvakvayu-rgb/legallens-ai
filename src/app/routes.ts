import { createBrowserRouter } from "react-router";
import { UploadScreen } from "./components/UploadScreen";
import { AnalysisScreen } from "./components/AnalysisScreen";
import { ChatScreen } from "./components/ChatScreen";
import { DocumentViewerScreen } from "./components/DocumentViewerScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: UploadScreen,
  },
  {
    path: "/analysis",
    Component: AnalysisScreen,
  },
  {
    path: "/chat",
    Component: ChatScreen,
  },
  {
    path: "/document",
    Component: DocumentViewerScreen,
  },
]);
