type VideoEmbedProps = {
  src: string;
  title: string;
};

export function VideoEmbed({ src, title }: VideoEmbedProps) {
  return (
    <div className="reader-card__preview reader-card__preview--video reader-card__preview--embed">
      <iframe
        src={src}
        title={title}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
