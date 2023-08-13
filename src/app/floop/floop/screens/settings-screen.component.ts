import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { settings } from 'ionicons/icons';
import { FloopDeviceService } from '../../services/floop-device.service';
import { SynthService } from '../../services/synth.service';
import { FloopSettings } from '../../types/floop.types';


@Component( {
	selector: 'settings-screen',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles:[`
		:host {
			display: flex;
			flex-direction: column;
			overflow: auto;

			justify-content: flex-start;
		}
	`],
	template: `

		<ion-spinner *ngIf="busy" name="circular"></ion-spinner>

		<ion-list *ngIf="!busy" lines="full">
			<ion-item>
				<ion-checkbox [(ngModel)]="settings.quickBoot"
							  (ngModelChange)="settingsChanged()"
							  labelPlacement="start"
				>Quick Boot (skips boot animation)
				</ion-checkbox>
			</ion-item>
			<ion-item>
				<ion-checkbox [(ngModel)]="settings.loadSongAfterBoot"
							  (ngModelChange)="settingsChanged()"
							  labelPlacement="start"
				>Restore saved song on boot
				</ion-checkbox>
			</ion-item>

			<ion-item>
				<ion-range aria-label="Volume"
						   labelPlacement="start" label="Volume"
						   [(ngModel)]="settings.deviceVolume"
						   (ngModelChange)="settingsChanged()"
						   min="0" max="100"
				>
					<ion-icon slot="start" name="volume-low"></ion-icon>
					<ion-icon slot="end" name="volume-high"></ion-icon>
				</ion-range>
			</ion-item>
		</ion-list>

	`,
} )

export class SettingsScreenComponent implements OnInit{
	public busy = false;

	public settings:FloopSettings = {};

	constructor(
		public floopDevice:FloopDeviceService,
		public synth:SynthService,
		public cdr:ChangeDetectorRef
	){
		this.floopDevice.settingsChanged
			.pipe(takeUntilDestroyed())
			.subscribe( settings => {
				this.settings = settings;
				this.cdr.markForCheck();
			} );
	}

	async ngOnInit(){
		this.busy = true;
		this.cdr.markForCheck();

		await this.floopDevice.restoreSettings();
		this.settings = this.floopDevice.settings;
		this.busy = false;
		this.cdr.markForCheck();
	}

	public settingsChanged(){
		this.floopDevice.settings = this.settings;
	}


}
