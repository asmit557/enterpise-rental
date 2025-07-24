import { Suspense } from "react";
import SearchPage from "./searchPage"; // adjust path if different

export const dynamic = "force-dynamic"; // optional: disable static rendering

const Search =() => {
  return (
    <Suspense fallback={<div className="p-6">Loading search results...</div>}>
      <SearchPage />
    </Suspense>
  );
}
export default Search;
