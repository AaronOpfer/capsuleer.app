interface LoadingSpinnerProps {
    className?: string;
    waiting?: boolean;
}

export default function LoadingSpinner({className, waiting}: LoadingSpinnerProps) {
    const classes = ["spinner", className, waiting ? "waiting" : null].filter(Boolean).join(" ");
    return (
        <svg
            className={classes}
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid"
        >
            <path
                d="M10 50A40 40 0 0 0 90 50A40 42 0 0 1 10 50"
                fill="currentColor"
                stroke="none"
                transform="rotate(140.149 50 51)"
            >
                <animateTransform
                    attributeName="transform"
                    type="rotate"
                    calcMode="linear"
                    values="0 50 51;360 50 51"
                    keyTimes="0;1"
                    dur="0.5s"
                    begin="0s"
                    repeatCount="indefinite"
                />
            </path>
        </svg>
    );
}
