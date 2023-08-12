import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, forwardRef, HostBinding, Input, Renderer2, ViewChild } from '@angular/core';
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

			:host.compact {
				ion-icon {
					width: 12px;
					height: 12px;
				}

				.controls input {
					margin-inline-start: 2px;
					margin-inline-end: 2px;
				}
			}

			label {
				margin-inline-end: 20px;
			}

			.controls {
				display: flex;
				align-items: center;
				cursor: pointer;

				ion-icon {
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

					color: var(--flp-ui-fg);

					user-select: none;
					pointer-events: none;
					cursor: pointer;

					&:focus {
						background: #ffffff22;
					}
				}

				&.vertical {
					flex-direction: column;

					input {
						text-indent: 3px;
					}
				}

				&.direct-input {

				}
			}
		`,
	],
	template: `
		<div class="touch" #touch
			 (touchstart)="touchStart($event)"
			 (touchmove)="touchMove($event)"
			 (touchend)="touchEnd($event)"
			 (touchcancel)="touchCancel($event)"

			 (mousedown)="mouseStart($event)"
		>
			<label *ngIf="label">{{label}}</label>
			<div class="controls"
				 [class.vertical]="direction==='vertical'"
				 [class.direct-input]="!preventDirectInput"
				 (dblclick)="toggleDirectInput()"
			>
				<ion-icon [name]="direction==='vertical' ? 'caret-up' : 'caret-back'" (click)="valueStep(direction==='vertical', $event)"></ion-icon>
				<input #input
					   [(ngModel)]="value"
					   pattern="[0-9]"
					   [size]="size"
					   (blur)="commitDirectInput()"
					   (keydown.enter)="commitDirectInput()"
				/>
				<ion-icon [name]="direction==='vertical' ? 'caret-down' : 'caret-forward'" (click)="valueStep(direction==='horizontal', $event)"></ion-icon>
			</div>
		</div>
	`,
} )
export class InputStepperComponent implements ControlValueAccessor{
	@HostBinding( 'class.compact' ) get _isCompact(){ return this.compact; };

	@ViewChild( 'touch', { read: ElementRef } ) touchElement:ElementRef | undefined;
	@ViewChild( 'input', { read: ElementRef } ) input:ElementRef<HTMLInputElement> | undefined;

	@Input() public compact:boolean = false;
	@Input() public direction:'horizontal' | 'vertical' = 'horizontal';

	@Input() disabled = false;
	@Input() increment = 10;

	@Input() min:number | undefined;
	@Input() max:number | undefined;

	@Input() label:string | undefined;
	@Input() size:number = 4;

	public value:number | undefined;
	public preventDirectInput = true;

	private onChanged = ( value:number | undefined ) => undefined;
	private onTouched = () => undefined;

	private _touchStartPos:number | undefined;
	private _touchStartValue:number | undefined;

	@Input() public touchThreshold = 20;
	@Input() public touchSensitivity:number = 20;

	constructor(
		private cdr:ChangeDetectorRef,
		private renderer:Renderer2,
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
		this._setValue( value );
	}

	private _setValue( value:number | undefined ){
		this.value = this._clampValue( value );
		this.cdr.markForCheck();
	}

	private _clampValue( value:number | string | undefined ){
		// enforce limits
		if( value == null )
			return value;

		// just making sure we're dealing with a number
		if( typeof value === 'string' )
			value = Number( value );

		if( this.min != null && value < this.min )
			value = this.min;

		if( this.max != null && value > this.max )
			value = this.max;

		return value;
	}

	public valueStep( up:boolean = true, event:MouseEvent ){
		if( this.value == null )
			this.value = 0;

		Haptics.impact( { style: ImpactStyle.Medium } );

		const newValue = +this.value + ( up ? this.increment : -this.increment );
		this._setValue( newValue );


		this.out();
		this.cdr.markForCheck();
	}


	public toggleDirectInput(){
		this.preventDirectInput = !this.preventDirectInput;
		if( this.preventDirectInput )
			this.input?.nativeElement.focus();
	}


	public commitDirectInput(){
		this.value = this._clampValue( this.value );
		this.preventDirectInput = true;
		this.out();
		this.cdr.markForCheck();
	}


	public touchStart( $event:TouchEvent ){
		this._touchStartValue = this.value;
		this._touchStartPos = $event.touches[0][this.direction === 'horizontal' ? 'clientX' : 'clientY'];
	}

	public touchMove( $event:TouchEvent ){
		const dist = this._touchStartPos! - $event.touches[0][this.direction === 'horizontal' ? 'clientX' : 'clientY'];
		this._handleMove( dist );
	}

	public touchEnd( $event:TouchEvent ){
		this._touchStartPos = undefined;
	}

	public touchCancel( $event:TouchEvent ){
		this._touchStartPos = undefined;
	}


	public mouseStart( $event:MouseEvent ){
		this._touchStartValue = this.value;
		this._touchStartPos = $event[this.direction === 'horizontal' ? 'clientX' : 'clientY'];

		const cleanupMove = this.renderer.listen( 'document', 'mousemove', ( event:MouseEvent ) => {
			let dist = this._touchStartPos! - event[this.direction === 'horizontal' ? 'clientX' : 'clientY'];
			this._handleMove( dist );
		} );
		const cleanupEnd = this.renderer.listen( 'document', 'mouseup', ( event:MouseEvent ) => {
			this._touchStartPos = undefined;
			cleanupMove();
			cleanupEnd();
		} );
	}


	private _handleMove( dist:number ){
		if( Math.abs( dist ) < this.touchThreshold )
			return;

		if( this.direction === 'vertical' )
			dist *= -1;

		const valueChange = ( dist / this.touchSensitivity ) * this.increment;
		const newValue = this._clampValue( this._touchStartValue! - valueChange );
		if( newValue != this.value )
			Haptics.impact( { style: ImpactStyle.Light } );

		this.value = newValue;

		this.out();
		this.cdr.markForCheck();
	}
}
