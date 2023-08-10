import { Directive, ViewContainerRef } from '@angular/core';


/**
 * wrapper for dynamic component instanciation
 */
@Directive( {
	selector: '[comp-out]'
} )
export class CompOutDirective{
	constructor( public viewContainerRef:ViewContainerRef ){ }
}
