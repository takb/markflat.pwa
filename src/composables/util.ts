import type {Song} from './store';

const mergeContent = (data: Song | null) => {
    if (!data) {
        return '';
    }
    return `Front matter \n\n --- \n\n#${data.title} - ${data.author}\n${data.content}\n**bold**\n\n---\n\nconst sizes = useResponsive()\nconsole.log('argh', variable)\n~Chorus {Eb}This is a test song {b}content\n\n~Verse {Bb}This is the first verse of the song\n\n~Chorus {Eb}This is the {a}chorus again\n\n~Outro {F}This is the outro of the song`;
}

const unmergeContent = (data: Song, content: String): Song => {
    const matched = content.match(/#(.+?) - (.+)\n(.*)/);
    return {
        id: data.id,
        title : matched ? matched[1].trim() : data.title,
        author : matched ? matched[2].trim() : data.author,
        content : matched ? matched[3].trim() : data.content
    }
}

export { mergeContent, unmergeContent };