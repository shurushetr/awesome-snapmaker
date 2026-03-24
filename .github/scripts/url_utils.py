import re
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

def normalize_url(url):
    """
    Normalizes a URL to accurately detect duplicates.
    Specifically handles YouTube URLs to preserve video IDs ('v' parameter) 
    while discarding other params.
    """
    if not url:
        return ""
        
    url = url.strip().lower()
    
    # Ensure scheme
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url
        
    parsed = urlparse(url)
    netloc = parsed.netloc
    
    # Remove 'www.'
    if netloc.startswith('www.'):
        netloc = netloc[4:]
        
    path = parsed.path
    
    # Handle YouTube specifically
    if netloc in ['youtube.com', 'youtu.be']:
        if netloc == 'youtu.be':
            # https://youtu.be/VIDEO_ID -> https://youtube.com/watch?v=VIDEO_ID
            video_id = path.lstrip('/')
            query_string = f"v={video_id}"
            netloc = 'youtube.com'
            path = '/watch'
        else:
            # https://youtube.com/watch?v=VIDEO_ID or https://youtube.com/playlist?list=PLAYLIST_ID
            qs = parse_qs(parsed.query)
            
            params = []
            if 'v' in qs:
                params.append(f"v={qs['v'][0]}")
            if 'list' in qs:
                params.append(f"list={qs['list'][0]}")
                
            query_string = '&'.join(params)
    else:
        # For non-YouTube, drop all query parameters (as they are usually tracking)
        query_string = ''
        
    core_url = urlunparse((parsed.scheme, netloc, path, '', query_string, ''))
    
    # Strip trailing slash for consistency
    return core_url.rstrip('/')
