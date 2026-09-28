import { useEffect } from 'react';

const APP_TITLE_SUFFIX = 'Work Simulator';

export function useDocumentTitle(title: string): void {
    useEffect(() => {
        if (title && title.trim()) {
            document.title = `${title.trim()} · ${APP_TITLE_SUFFIX}`;
        } else {
            document.title = APP_TITLE_SUFFIX;
        }
    }, [title]);
}

export default useDocumentTitle;
