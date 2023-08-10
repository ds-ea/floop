import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Haptics, ImpactStyle } from '@capacitor/haptics';


@Component( {
	selector: 'input-stepper',
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR, multi: true,
			useExisting: forwardRef( () => InputStepperComponent ),
		},
	],
	styles: [
		`
			:host, .touch {
				display: flex;
				align-items: center;
				justify-content: flex-start;
				user-select: none;
			}

			label{
				margin-inline-end: 20px;
			}

			.controls {
				display: flex;
				align-items: center;

				ion-icon{
					cursor: pointer;
				}

				input {
					width: auto;
					appearance: none;
					background: transparent;
					border: none;
					outline: none;

					padding: 3px 4px 2px;
					margin-inline-start: 10px;
					margin-inline-end: 10px;

					font-size: var(--input-font-size, 20px);
					text-align: center;


					&:focus{
						background: #ffffff22;
					}
				}
			}
		`,
	],
	template: `
		<div class="touch"
			 (touchstart)="touchStart($event)"
			 (touchmove)="touchMove($event)"
			 (touchend)="touchEnd($event)"
			 (touchcancel)="touchCancel($event)"
		>
			<label *ngIf="label">{{label}}</label>
			<div class="controls">
				<ion-icon name="caret-back" (click)="valueStep(false, $event)"></ion-icon>
				<input #input
					   [(ngModel)]="value"
					   [disabled]="disabled"
					   pattern="[0-9]"
					   [size]="size"
					   [readOnly]="preventDirectInput"

					   (click)="toggleDirectInput()"

					   (blur)="commitDirectInput()"
					   (keydown.enter)="commitDirectInput()"
				/>
				<ion-icon name="caret-forward" (click)="valueStep(true, $event)"></ion-icon>
			</div>
		</div>
	`,
} )
export class InputStepperComponent implements ControlValueAccessor{

	@ViewChild('input') input:HTMLInputElement|undefined;

	public value:number | undefined;

	@Input() disabled = false;
	@Input() increment = 10;

	@Input() min:number | undefined;
	@Input() max:number | undefined;

	@Input() label:string|undefined;
	@Input() size:number = 4;

	private onChanged = ( value:number | undefined ) => undefined;
	private onTouched = () => undefined;

	private _touchStartX:number|undefined;
	private _touchStartValue:number|undefined;

	@Input() public touchThreshold = 20;
	@Input() public touchSensitivity:number = 20;

	public preventDirectInput = true;

	constructor(
		private cdr:ChangeDetectorRef,
	){ }

	public out(){
		this.onTouched();
		this.onChanged( this.value );
	}

	public registerOnChange( fn:InputStepperComponent['onChanged'] ):void{
		this.onChanged = fn;
	}

	public registerOnTouched( fn:any ):void{
		this.onTouched = fn;
	}

	public setDisabledState( isDisabled:boolean ):void{
		this.disabled = isDisabled;
	}

	public writeValue( value:number | undefined ):void{
		this._setValue(value);
	}

	private _setValue( value:number|undefined ){
		this.value = this._clampValue( value );
		this.cdr.markForCheck();
	}

	private _clampValue( value:number | undefined ){
		// enforce limits
		if( value == null )
			return value;

		// just making sure we're dealing with a number
		value = Number(value);

		if( this.min != null && value < this.min )
			value = this.min;

		if( this.max != null && value > this.max )
			value = this.max;

		return value;
	}

	public valueStep( up:boolean = true, event:MouseEvent ){
		if( this.value == null )
			this.value = 0;

		Haptics.impact({style: ImpactStyle.Medium});

		const newValue = +this.value + ( up ? this.increment : -this.increment );
		this._setValue( newValue );


		this.out();
		this.cdr.markForCheck();
	}


	public toggleDirectInput(){
		// not toggling for now, just straight clicking
//		this.preventDirectInput = !this.preventDirectInput;
		if( this.preventDirectInput )
			this.preventDirectInput = false;

		if( this.preventDirectInput )
			this.input?.focus();

	}


	public commitDirectInput(){
		this.value = this._clampValue( this.value );
		this.preventDirectInput = true;
		this.out();
		this.cdr.markForCheck();
	}



	public touchStart( $event:TouchEvent ){
		this._touchStartValue = this.value;
		this._touchStartX = $event.touches[0].clientX;
	}

	public touchMove( $event:TouchEvent ){
		const dist = this._touchStartX! - $event.touches[0].clientX;

		if( Math.abs(dist) < this.touchThreshold )
			return;


		const valueChange = Math.round(dist / this.touchSensitivity) * this.increment;
		const newValue = this._clampValue( Math.round(this._touchStartValue! - valueChange ) );
		if( newValue != this.value )
			Haptics.impact({style: ImpactStyle.Light});

		this.value = newValue ;

		this.out();
		this.cdr.markForCheck();
	}

	public touchEnd( $event:TouchEvent ){
		this._touchStartX = undefined;
	}

	public touchCancel( $event:TouchEvent ){
		this._touchStartX = undefined;
	}


}
