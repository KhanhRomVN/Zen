declare global {
    interface Window {
        acquireVsCodeApi?: () => {
            postMessage: (message: any) => void;
            getState: () => any;
            setState: (state: any) => void;
        };
    }
}
export declare const useVSCodeTheme: () => {
    themeKind: number;
};
//# sourceMappingURL=useVSCodeTheme.d.ts.map