import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';


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
			:host {
				display: flex;
				align-items: center;
				justify-content: flex-start;
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

					text-align: center;

					&:focus{
						background: #ffffff22;
					}
				}
			}
		`,
	],
	template: `
		<label *ngIf="label">{{label}}</label>
		<div class="controls">
			<ion-icon name="caret-back" (click)="valueStep(false, $event)"></ion-icon>
			<input [(ngModel)]="value"
				   (blur)="checkInput()"
				   [disabled]="disabled"
				   pattern="[0-9]"
				   [size]="size"
			/>
			<ion-icon name="caret-forward" (click)="valueStep(true, $event)"></ion-icon>
		</div>`,
} )
export class InputStepperComponent implements ControlValueAccessor{

	public value:number | undefined;

	@Input() disabled = false;
	@Input() increment = 10;

	@Input() min:number | undefined;
	@Input() max:number | undefined;

	@Input() label:string|undefined;
	@Input() size:number = 4;

	private onChanged = ( value:number | undefined ) => undefined;
	private onTouched = () => undefined;


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

		const newValue = +this.value + ( up ? this.increment : -this.increment );
		this._setValue( newValue );

		this.out();
		this.cdr.markForCheck();
	}



	public checkInput(){
		this.value = this._clampValue( this.value );
		this.out();
		this.cdr.markForCheck();
	}
}
