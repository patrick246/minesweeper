import {Vector2} from "game/dist";

export type MouseListener = (position: Vector2, buttonCode: number) => void;

export class MouseDragListener {
    private dragStartPosition: Vector2 | undefined;
    private isDrag: boolean = false;

    private readonly dragListeners: MouseListener[] = [];
    private readonly clickListeners: MouseListener[] = [];

    constructor(element: HTMLElement) {
        element.addEventListener('contextmenu', (event: MouseEvent) => {
            event.preventDefault();
        });

        element.addEventListener('mousedown', (event: MouseEvent) => {
            if(event.buttons === 1) {
                this.dragStartPosition = new Vector2(event.screenX, event.screenY);
            }
        });


        element.addEventListener('mousemove', (event: MouseEvent) => {
            if(event.buttons === 0) {
                this.dragStartPosition = undefined;
                return;
            }
            if(this.dragStartPosition) {
                this.isDrag = true;
                const newPos = new Vector2(event.screenX, event.screenY);
                const offset = this.dragStartPosition.subtract(newPos)
                this.dragListeners.forEach(cb => cb(offset, event.buttons));
                this.dragStartPosition = newPos;
            }
        });
        element.addEventListener('mouseup', (event: MouseEvent) => {
            console.log(event);
            if(!this.isDrag) {
                this.clickListeners.forEach(cb => cb(new Vector2(event.x, event.y), event.button));
            }
            this.dragStartPosition = undefined;
            this.isDrag = false;
        });
    }

    public on(_: 'drag', dragFunction: MouseListener): void;

    public on(_: 'click', clickFunction: MouseListener): void;

    public on(type: string, callback: MouseListener): void {
        if(type === 'drag') {
            this.dragListeners.push(callback);
        } else if(type === 'click') {
            this.clickListeners.push(callback);
        }
    }
}