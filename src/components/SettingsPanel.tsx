import { DeviceSelect } from "./DeviceSelect";
import { MixSliders } from "./MixSliders";
import { Pane } from "./Pane";

export function SettingsPanel() {
	return (
		<>
			<Pane id="devices" title="Devices">
				<div className="flex flex-col gap-3">
					<div className="block text-sm text-neutral-400">
						Input
						<div className="mt-1">
							<DeviceSelect kind="input" />
						</div>
					</div>
					<div className="block text-sm text-neutral-400">
						Output
						<div className="mt-1">
							<DeviceSelect kind="output" />
						</div>
					</div>
					<div className="block text-sm text-neutral-400">
						Camera
						<div className="mt-1">
							<DeviceSelect kind="camera" />
						</div>
					</div>
				</div>
			</Pane>
			<Pane id="mix" title="Mix">
				<MixSliders />
			</Pane>
		</>
	);
}
