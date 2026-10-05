import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "./styles/tokens.css";
import "./styles/atlas.css";
import "./styles/solar-theme.css";

import "./styles/earth.css";
import "./styles/optical-glass.css";
import "./styles/earth-layout.css";
import "./styles/solar-ui-adapter.css";
import "./styles/earth-ui-bindings.css";
import "./styles/atlas-ui.css";
import "./styles/mobile-ui.css";
import "./styles/heritage-preview.css";
import "./styles/unified-ui.css";

import App from "./App";
import {useAtlas} from "./state/store";

useAtlas.setState({view:"GLOBE"});
createRoot(document.getElementById("root")!).render(<App />);
