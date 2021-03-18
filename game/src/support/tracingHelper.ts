import {Context} from "./Context";
import {Span, Tracer} from "opentracing";

interface Traceable {
    getTracer(): Tracer;
}

export function traced(contextParameterIndex: number = 0) {
    return <T extends Traceable>(target: T, propertyName: string, descriptor: TypedPropertyDescriptor<any>) => {
        console.log(target, propertyName, descriptor);
        const originalMethod = descriptor.value;
        descriptor.value = function () {
            const targetClass = this as T;
            const parentContext: Context = arguments[contextParameterIndex];
            const parentSpan = parentContext.getSpan();

            const newArguments = [...arguments];
            let span: Span | undefined;

            if(parentSpan) {
                span = targetClass.getTracer().startSpan(targetClass.constructor.name + '::' + propertyName, {childOf: parentContext.getSpan()});
                newArguments[contextParameterIndex] = parentContext.withSpan(span);
            }

            if(originalMethod) {
                const returnValue = originalMethod.apply(this, newArguments);
                if("then" in returnValue) {
                    return returnValue.then((result: any) => {
                        span && span.finish();
                        return result;
                    });
                }
                span && span.finish();
                return returnValue;
            }

        };
    }
}