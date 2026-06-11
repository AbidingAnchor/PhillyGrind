import ListingForm from '../components/ListingForm.jsx';
import { jobCategories } from '../data/listings.js';

function PostJob() {
  return (
    <section className="form-page">
      <div className="page-heading">
        <span className="eyebrow">Employers</span>
        <h1>Post a Job</h1>
        <p>Reach local workers looking for reliable Philadelphia jobs and shifts.</p>
      </div>
      <ListingForm type="job" categories={jobCategories} />
    </section>
  );
}

export default PostJob;
