import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ɵEmptyOutletComponent } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CompOutDirective } from './directives/comp-out.directive';
import { InputStepperComponent } from './floop/components/input-stepper.component';
import { BootScreenComponent } from './floop/screens/boot-screen.component';
import { InstrumentScreenComponent } from './floop/screens/instrument/instrument-screen.component';
import { InstrumentPage } from './floop/screens/instrument/instrument.page';
import { SettingsScreenComponent } from './floop/screens/settings-screen.component';
import { SongScreenComponent } from './floop/screens/song-screen.component';
import { VizScreenComponent } from './floop/screens/viz-screen.component';
import { FloopView } from './floop/floop.view';
import { FloopDeviceService } from './services/floop-device.service';
import { SynthService } from './services/synth.service';



@NgModule( {
	imports: [
		CommonModule,
		IonicModule,
		FormsModule,
		ɵEmptyOutletComponent,
	],
	declarations: [
		CompOutDirective,
		InputStepperComponent,

		FloopView,
		BootScreenComponent,
		SettingsScreenComponent,
		SongScreenComponent,
		VizScreenComponent,
		InstrumentScreenComponent,
		InstrumentPage,
	],
	providers: [
		SynthService,
		FloopDeviceService,
	],
} )
export class FloopModule{}
