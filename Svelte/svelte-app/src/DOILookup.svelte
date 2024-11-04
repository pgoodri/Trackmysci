<script>
    let doi = '';
    let articleData = null;
    let errorMessage = '';
  
    async function fetchDOIDetails() {
      try {
        const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
        const data = await response.json();
  
        if (data.status !== 'ok') {
          throw new Error('No article found with the provided DOI');
        }
        
        articleData = data.message;
        errorMessage = '';
      } catch (error) {
        articleData = null;
        errorMessage = error.message;
      }
    }
  </script>
  
  <main>
    <h1>DOI Lookup</h1>
    <input type="text" placeholder="Enter DOI" bind:value={doi} />
    <button on:click={fetchDOIDetails}>Lookup</button>
  
    {#if errorMessage}
      <p class="error">{errorMessage}</p>
    {/if}
  
    {#if articleData}
      <div class="article-details">
        <h2>{articleData.title[0]}</h2>
        <p><strong>Author(s):</strong> {articleData.author.map(author => `${author.given} ${author.family}`).join(', ')}</p>
        <p><strong>Published in:</strong> {articleData['container-title'][0]}</p>
        <p><strong>Publication Date:</strong> {articleData.created['date-parts'][0].join('-')}</p>
        <a href={articleData.URL} target="_blank">View Full Article</a>
      </div>
    {/if}
  </main>
  
  <style>
    .article-details {
      margin-top: 20px;
    }
    .error {
      color: red;
    }
  </style>
  