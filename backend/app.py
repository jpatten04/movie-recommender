from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
import json
import re

load_dotenv()

app = Flask(__name__)
CORS(app)

TMDB_BASE_URL = os.getenv('TMDB_BASE_URL')
HF_API_URL = os.getenv('HUGGINGFACE_API_URL')
TMDB_API_KEY = os.getenv('TMDB_API_KEY')
HF_API_KEY = os.getenv('HUGGINGFACE_API_KEY', '')

@app.route('/api/search', methods=['GET'])
def search_movies():
    # Search for movies based on query
    query = request.args.get('query', '')
    
    if not query:
        return jsonify({'results': []})
    
    try:
        response = requests.get(
            f'{TMDB_BASE_URL}/search/movie',
            params={
                'api_key': TMDB_API_KEY,
                'query': query,
                'language': 'en-US',
                'page': 1
            }
        )
        response.raise_for_status()
        data = response.json()
        
        # Return top 5 results for autocomplete
        results = data.get('results', [])[:5]
        return jsonify({'results': results})
    
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/movie/<int:movie_id>', methods=['GET'])
def get_movie_details(movie_id):
    # Get detailed information about a specific movie
    try:
        response = requests.get(
            f'{TMDB_BASE_URL}/movie/{movie_id}',
            params={
                'api_key': TMDB_API_KEY,
                'language': 'en-US'
            }
        )
        response.raise_for_status()
        movie_data = response.json()
        
        return jsonify(movie_data)
    
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommend', methods=['POST'])
def recommend_movies():
    # Get AI-powered movie recommendations using Hugging Face
    data = request.json
    movie_title = data.get('title')
    movie_overview = data.get('overview')
    genres = data.get('genres', [])
    
    try:
        genre_names = ', '.join([g['name'] for g in genres])
        
        prompt = f"""You are a movie recommendation assistant. Based on the movie 
            "{movie_title}" ({genre_names}), with this plot: "{movie_overview}",
            recommend 6 similar movies. For EACH movie, explain specifically WHY
            it's similar - mention themes, tone, style, plot elements, or character
            types. Make the reason 1-2 full sentences.

            You MUST respond with ONLY a valid flat JSON array. Use regular straight quotes
            and apostrophes only. Don't use any abnormal formatting for anything. Be sure
            to include all closing brackets and arrays that you need for the response to be
            a valid JSON. Dont include any '\' in the response either.
            
            Format:
            [{{"title": "Movie Title 1", "reason": "Specific explanation"}},
            {{"title": "Movie Title 2", "reason": "Specific explanation"}},
            {{"title": "Movie Title 3", "reason": "Specific explanation"}},
            {{"title": "Movie Title 4", "reason": "Specific explanation"}},
            {{"title": "Movie Title 5", "reason": "Specific explanation"}},
            {{"title": "Movie Title 6", "reason": "Specific explanation"}}]

            Respond with ONLY the JSON array. No other text."""

        headers = {'Content-Type': 'application/json'}
        if HF_API_KEY:
            headers['Authorization'] = f'Bearer {HF_API_KEY}'
        
        print(f"Calling Hugging Face API for: {movie_title}")
        
        hf_response = requests.post(
            HF_API_URL,
            headers=headers,
            json={
                "model": "meta-llama/Llama-3.2-3B-Instruct:novita",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that responds only with valid JSON arrays. Never include explanatory text, only the JSON array. Always use straight quotes, never smart quotes."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "max_tokens": 2000,
                "temperature": 0.7
            },
            timeout=60
        )
        
        print(f"HF Response Status: {hf_response.status_code}")
        
        if hf_response.status_code == 200:
            result = hf_response.json()
            
            if 'choices' in result and len(result['choices']) > 0:
                response_text = result['choices'][0]['message']['content']
            else:
                raise Exception("Unexpected response format from Hugging Face")
            
            print(f"Raw response: {response_text}")
            
            # Clean the response
            response_text = response_text.strip()
            response_text = re.sub(r'^```json\s*', '', response_text)
            response_text = re.sub(r'^```\s*', '', response_text)
            response_text = re.sub(r'\s*```$', '', response_text)
            
            # Try to parse
            try:
                recommendations = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract just the array
                match = re.search(r'\[.*\]', response_text, re.DOTALL)
                if match:
                    response_text = match.group()
                    # Check if JSON is incomplete and fix it
                    open_braces = response_text.count('{')
                    close_braces = response_text.count('}')
                    open_brackets = response_text.count('[')
                    close_brackets = response_text.count(']')
                    
                    if open_braces > close_braces:
                        response_text += '}' * (open_braces - close_braces)
                    if open_brackets > close_brackets:
                        response_text += ']' * (open_brackets - close_brackets)
                    
                    print(f"Fixed JSON: {response_text[:300]}...")
                    recommendations = json.loads(response_text)
                else:
                    raise
            
            # Validate and enrich with TMDB data
            enriched_recommendations = []
            for rec in recommendations[:6]:
                if not isinstance(rec, dict) or 'title' not in rec or 'reason' not in rec:
                    continue
                    
                search_response = requests.get(
                    f'{TMDB_BASE_URL}/search/movie',
                    params={
                        'api_key': TMDB_API_KEY,
                        'query': rec['title'],
                        'language': 'en-US'
                    }
                )
                
                if search_response.status_code == 200:
                    search_data = search_response.json()
                    if search_data.get('results'):
                        movie = search_data['results'][0]
                        enriched_recommendations.append({
                            'id': movie['id'],
                            'title': movie['title'],
                            'poster_path': movie.get('poster_path'),
                            'reason': rec['reason'],
                            'release_date': movie.get('release_date', 'N/A'),
                            'vote_average': movie.get('vote_average', 0)
                        })
            
            if enriched_recommendations:
                print(f"Successfully got {len(enriched_recommendations)} AI recommendations")
                return jsonify({'recommendations': enriched_recommendations})
            else:
                print("No valid recommendations, falling back")
                return get_genre_based_recommendations(genres, movie_title)
        else:
            print(f"HF API error: {hf_response.status_code}")
            return get_genre_based_recommendations(genres, movie_title)
    
    except Exception as e:
        print(f"AI recommendation error: {e}")
        import traceback
        traceback.print_exc()
        return get_genre_based_recommendations(genres, movie_title)

def get_genre_based_recommendations(genres, exclude_title):
    # Fallback: Get recommendations based on genre from TMDB
    try:
        if not genres:
            return jsonify({'recommendations': []})
        
        genre_ids = ','.join([str(g['id']) for g in genres[:2]])
        genre_names = ', '.join([g['name'] for g in genres[:2]])
        
        response = requests.get(
            f'{TMDB_BASE_URL}/discover/movie',
            params={
                'api_key': TMDB_API_KEY,
                'with_genres': genre_ids,
                'sort_by': 'vote_average.desc',
                'vote_count.gte': 1000,
                'language': 'en-US',
                'page': 1
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            results = [m for m in data.get('results', [])[:10] if m['title'] != exclude_title][:6]
            
            recommendations = [{
                'id': movie['id'],
                'title': movie['title'],
                'poster_path': movie.get('poster_path'),
                'reason': f"Shares the {genre_names} genre with strong ratings and similar audience appeal",
                'release_date': movie.get('release_date', 'N/A'),
                'vote_average': movie.get('vote_average', 0)
            } for movie in results]
            
            return jsonify({'recommendations': recommendations})
        
        return jsonify({'recommendations': []})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)