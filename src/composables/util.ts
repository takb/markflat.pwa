import type {Song} from './store';

const extractFromContent = (data: Song, content: String): Song => {
    const matched = content.match(/#(.+?) - (.+)\n(.*)/);
    return {
        id: data.id,
        title : matched ? matched[1].trim() : data.title,
        artist : matched ? matched[2].trim() : data.artist,
        content : matched ? matched[3].trim() : data.content
    }
}

export { extractFromContent };