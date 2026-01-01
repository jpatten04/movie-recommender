import { useState, useEffect, useRef } from "react";
import { Search, Star, Calendar, Clapperboard } from "lucide-react";

export default function MovieRecommender() {
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [selectedMovie, setSelectedMovie] = useState(null);
	const [recommendations, setRecommendations] = useState([]);
	const [loading, setLoading] = useState(false);
	const [showDropdown, setShowDropdown] = useState(false);
	const searchRef = useRef(null);

	const API_URL = import.meta.env.VITE_API_URL;
	const TMDB_IMAGE_URL = import.meta.end.VITE_TMDB_IMAGE_URL;

	useEffect(() => {
		const handleClickOutside = (e) => {
			if (searchRef.current && !searchRef.current.contains(e.target)) {
				setShowDropdown(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		if (searchQuery.length > 2) {
			const timer = setTimeout(() => {
				searchMovies();
			}, 300);
			return () => clearTimeout(timer);
		} else {
			setSearchResults([]);
			setShowDropdown(false);
		}
	}, [searchQuery]);

	const searchMovies = async () => {
		try {
			const response = await fetch(`${API_URL}/search?query=${encodeURIComponent(searchQuery)}`);
			const data = await response.json();
			setSearchResults(data.results || []);
			setShowDropdown(data.results.length > 0);
		} catch (error) {
			console.error("Search error:", error);
		}
	};

	const selectMovie = async (movieId) => {
		setLoading(true);
		setShowDropdown(false);
		setRecommendations([]);

		try {
			const response = await fetch(`${API_BASE}/movie/${movieId}`);
			const data = await response.json();
			setSelectedMovie(data);
		} catch (error) {
			console.error("Error fetching movie:", error);
		} finally {
			setLoading(false);
		}
	};

	const getRecommendations = async () => {
		if (!selectedMovie) return;

		setLoading(true);
		try {
			const response = await fetch(`${API_BASE}/recommend`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: selectedMovie.title,
					overview: selectedMovie.overview,
					genres: selectedMovie.genres,
				}),
			});
			const data = await response.json();
			setRecommendations(data.recommendations || []);
		} catch (error) {
			console.error("Error getting recommendations:", error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
			<div className="container mx-auto px-4 py-8 max-w-6xl">
				<div className="text-center mb-12">
					<div className="flex items-center justify-center gap-3 mb-4">
						<Clapperboard className="w-12 h-12 text-purple-400" />
						<h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
							Movie Recommender
						</h1>
					</div>
					<p className="text-gray-300 text-lg">
						Discover your next favorite movie with AI-powered recommendations
					</p>
				</div>

				<div className="relative mb-8" ref={searchRef}>
					<div className="relative">
						<Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
						<input
							type="text"
							placeholder="Search for a movie..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
							className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
						/>
					</div>

					{showDropdown && searchResults.length > 0 && (
						<div className="absolute w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
							{searchResults.map((movie) => (
								<div
									key={movie.id}
									onClick={() => selectMovie(movie.id)}
									className="flex items-center gap-4 p-3 hover:bg-gray-700 cursor-pointer transition"
								>
									{movie.poster_path ? (
										<img
											src={`${TMDB_IMAGE_URL}${movie.poster_path}`}
											alt={movie.title}
											className="w-12 h-18 object-cover rounded"
										/>
									) : (
										<div className="w-12 h-18 bg-gray-700 rounded flex items-center justify-center">
											<Clapperboard className="w-6 h-6 text-gray-500" />
										</div>
									)}
									<div className="flex-1">
										<div className="font-semibold">{movie.title}</div>
										<div className="text-sm text-gray-400">
											{movie.release_date ? new Date(movie.release_date).getFullYear() : "N/A"}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{selectedMovie && (
					<div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden mb-8 border border-gray-700">
						<div className="md:flex">
							<div className="md:w-1/3">
								{selectedMovie.poster_path ? (
									<img
										src={`${TMDB_IMAGE_URL}${selectedMovie.poster_path}`}
										alt={selectedMovie.title}
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-96 bg-gray-700 flex items-center justify-center">
										<Film className="w-24 h-24 text-gray-600" />
									</div>
								)}
							</div>

							<div className="md:w-2/3 p-8">
								<h2 className="text-4xl font-bold mb-4 text-purple-300">{selectedMovie.title}</h2>

								<div className="flex flex-wrap items-center gap-4 mb-6">
									<div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1 rounded-full">
										<Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
										<span className="font-semibold">{selectedMovie.vote_average?.toFixed(1)}</span>
									</div>

									{selectedMovie.release_date && (
										<div className="flex items-center gap-2 text-gray-300">
											<Calendar className="w-5 h-5" />
											<span>{new Date(selectedMovie.release_date).getFullYear()}</span>
										</div>
									)}

									{selectedMovie.runtime && (
										<span className="text-gray-300">{selectedMovie.runtime} min</span>
									)}
								</div>

								<div className="flex flex-wrap gap-2 mb-6">
									{selectedMovie.genres?.map((genre) => (
										<span
											key={genre.id}
											className="px-3 py-1 bg-purple-500/30 rounded-full text-sm"
										>
											{genre.name}
										</span>
									))}
								</div>

								<p className="text-gray-300 leading-relaxed mb-6">{selectedMovie.overview}</p>

								<button
									onClick={getRecommendations}
									disabled={loading}
									className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
								>
									{loading ? "Finding Recommendations..." : "Get AI Recommendations"}
								</button>
							</div>
						</div>
					</div>
				)}

				{recommendations.length > 0 && (
					<div>
						<h3 className="text-3xl font-bold mb-6 text-center">Recommended For You</h3>
						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
							{recommendations.map((rec) => (
								<div
									key={rec.id}
									className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-purple-500 transition cursor-pointer"
									onClick={() => selectMovie(rec.id)}
								>
									{rec.poster_path ? (
										<img
											src={`${TMDB_IMAGE_URL}${rec.poster_path}`}
											alt={rec.title}
											className="w-full h-64 object-cover"
										/>
									) : (
										<div className="w-full h-64 bg-gray-700 flex items-center justify-center">
											<Film className="w-16 h-16 text-gray-600" />
										</div>
									)}

									<div className="p-4">
										<h4 className="text-xl font-bold mb-2 text-purple-300">{rec.title}</h4>

										<div className="flex items-center gap-3 mb-3 text-sm text-gray-400">
											{rec.vote_average > 0 && (
												<div className="flex items-center gap-1">
													<Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
													<span>{rec.vote_average.toFixed(1)}</span>
												</div>
											)}
											{rec.release_date && (
												<span>{new Date(rec.release_date).getFullYear()}</span>
											)}
										</div>

										<p className="text-sm text-gray-300 italic">{rec.reason}</p>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
