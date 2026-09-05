import { CameraView } from "./components/CameraView";
import { ChordDisplay } from "./components/ChordDisplay";
import { Meter } from "./components/Meter";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { useGesture } from "./hooks/useGesture";
import { useHarmonyBridge } from "./hooks/useHarmonyBridge";

function Runtime() {
	useAudioEngine();
	useGesture();
	useHarmonyBridge();
	return null;
}

export default function App() {
	return (
		<div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
			<Runtime />
			<div className="flex min-h-0 flex-1">
				<div className="min-h-0 min-w-0 flex-1">
					<CameraView />
				</div>
				<Sidebar>
					<ChordDisplay />
					<Meter />
					<SettingsPanel />
				</Sidebar>
			</div>
			<StatusBar />
		</div>
	);
}
