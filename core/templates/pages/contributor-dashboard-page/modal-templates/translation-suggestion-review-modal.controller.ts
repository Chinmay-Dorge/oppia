// Copyright 2020 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @fileoverview Controller for translation suggestion review modal.
 */

import { ThreadMessage } from 'domain/feedback_message/ThreadMessage.model';

require('domain/utilities/language-util.service.ts');
require('services/alerts.service.ts');
require('services/context.service.ts');
require('services/site-analytics.service.ts');
require('services/suggestion-modal.service.ts');
require('services/validators.service.ts');

angular.module('oppia').controller(
  'TranslationSuggestionReviewModalController', [
    '$http', '$scope', '$uibModalInstance', 'AlertsService', 'ContextService',
    'ContributionAndReviewService', 'ContributionOpportunitiesService',
    'LanguageUtilService', 'SiteAnalyticsService', 'UrlInterpolationService',
    'UserService', 'ValidatorsService', 'initialSuggestionId', 'reviewable',
    'subheading', 'suggestionIdToContribution', 'ACTION_ACCEPT_SUGGESTION',
    'ACTION_REJECT_SUGGESTION', 'IMAGE_CONTEXT', 'MAX_REVIEW_MESSAGE_LENGTH',
    function(
        $http, $scope, $uibModalInstance, AlertsService, ContextService,
        ContributionAndReviewService, ContributionOpportunitiesService,
        LanguageUtilService, SiteAnalyticsService, UrlInterpolationService,
        UserService, ValidatorsService, initialSuggestionId, reviewable,
        subheading, suggestionIdToContribution, ACTION_ACCEPT_SUGGESTION,
        ACTION_REJECT_SUGGESTION, IMAGE_CONTEXT, MAX_REVIEW_MESSAGE_LENGTH) {
      var resolvedSuggestionIds = [];
      $scope.reviewable = reviewable;
      $scope.activeSuggestionId = initialSuggestionId;
      $scope.activeContribution = suggestionIdToContribution[
        $scope.activeSuggestionId];
      $scope.activeSuggestion = $scope.activeContribution.suggestion;
      $scope.authorName = $scope.activeSuggestion.author_name;
      $scope.languageDescription = (
        LanguageUtilService.getAudioLanguageDescription(
          $scope.activeSuggestion.language_code));
      $scope.activeContributionDetails = $scope.activeContribution.details;
      $scope.subheading = subheading;
      $scope.MAX_REVIEW_MESSAGE_LENGTH = MAX_REVIEW_MESSAGE_LENGTH;
      $scope.startedEditing = false;
      $scope.translationUpdated = false;
      $scope.HTML_SCHEMA = {
        type: 'html'
      };
      $scope.UNICODE_SCHEMA = { type: 'unicode' };
      $scope.SET_OF_STRINGS_SCHEMA = {
        type: 'list',
        items: {
          type: 'unicode'
        }
      };
      $scope.canEditTranslation = false;

      $scope.updateSuggestion = function() {
        const updatedTranslation = $scope.editedContent;
        const suggestionId = $scope.activeSuggestion.suggestion_id;
        ContributionAndReviewService.updateTranslationSuggestionAsync(
          suggestionId,
          updatedTranslation,
          () => {
            $scope.translationHtml = updatedTranslation;
            $scope.translationUpdated = true;
            ContributionOpportunitiesService.
              reloadOpportunitiesEventEmitter.emit();
          },
          $scope.showTranslationSuggestionUpdateError);
        $scope.startedEditing = false;
      };

      delete suggestionIdToContribution[initialSuggestionId];
      var remainingContributions = Object.entries(suggestionIdToContribution);

      if (reviewable) {
        SiteAnalyticsService
          .registerContributorDashboardViewSuggestionForReview('Translation');
      }

      // The length of the commit message should not exceed 375 characters,
      // since this is the maximum allowed commit message size.
      var generateCommitMessage = function() {
        var contentId = $scope.activeSuggestion.change.content_id;
        var stateName = $scope.activeSuggestion.change.state_name;
        var contentType = contentId.split('_')[0];

        var commitMessage = `${contentType} section of "${stateName}" card`;

        return commitMessage;
      };

      var _getThreadHandlerUrl = function(suggestionId) {
        return UrlInterpolationService.interpolateUrl(
          '/threadhandler/<suggestionId>', { suggestionId });
      };

      var _getThreadMessagesAsync = function(threadId) {
        return $http.get(_getThreadHandlerUrl(threadId)).then((response) => {
          let threadMessageBackendDicts = response.data.messages;
          return threadMessageBackendDicts.map(
            m => ThreadMessage.createFromBackendDict(m));
        });
      };

      $scope.init = function() {
        let userCanReviewTranslationSuggestionsInLanguages: string[] = [];
        const languageCode: string = $scope.activeSuggestion.change.
          language_code;
        UserService.getUserInfoAsync().then(userInfo => {
          $scope.username = userInfo.getUsername();
          $scope.isCurriculumAdmin = userInfo.isCurriculumAdmin();
        });
        UserService.getUserContributionRightsDataAsync().then(
          userContributionRights => {
            userCanReviewTranslationSuggestionsInLanguages = (
              userContributionRights
                .can_review_translation_for_language_codes);
            $scope.canEditTranslation = (
              userCanReviewTranslationSuggestionsInLanguages.includes(
                languageCode) && $scope.username !== $scope.activeSuggestion.
                author_name
            );
          });
        $scope.resolvingSuggestion = false;
        $scope.lastSuggestionToReview = remainingContributions.length <= 0;
        $scope.translationHtml = (
          $scope.activeSuggestion.change.translation_html);
        $scope.status = $scope.activeSuggestion.status;
        $scope.contentHtml = (
          $scope.activeSuggestion.change.content_html);
        $scope.explorationContentHtml = (
          $scope.activeSuggestion.exploration_content_html);
        $scope.isHtmlContent = (
          $scope.activeSuggestion.change.data_format === 'html'
        );
        $scope.isUnicodeContent = (
          $scope.activeSuggestion.change.data_format === 'unicode'
        );
        $scope.isSetOfStringsContent = (
          $scope.activeSuggestion.change.data_format ===
            'set_of_normalized_string' ||
          $scope.activeSuggestion.change.data_format ===
            'set_of_unicode_string'
        );
        $scope.editedContent = $scope.translationHtml;
        $scope.reviewMessage = '';
        if (!reviewable) {
          $scope.suggestionIsRejected = (
            $scope.activeSuggestion.status === 'rejected');
          if ($scope.suggestionIsRejected) {
            _getThreadMessagesAsync($scope.activeSuggestionId).then(
              function(messageSummaries) {
                $scope.reviewMessage = messageSummaries[1].text;
              }
            );
          }
        }
      };

      $scope.init();

      $scope.showNextItemToReview = function(suggestionId) {
        resolvedSuggestionIds.push($scope.activeSuggestionId);
        var suggestionId = null;
        if ($scope.lastSuggestionToReview) {
          $uibModalInstance.close(resolvedSuggestionIds);
          return;
        }

        [$scope.activeSuggestionId, $scope.activeContribution] = (
          remainingContributions.pop());
        $scope.activeSuggestion = $scope.activeContribution.suggestion;
        $scope.activeContributionDetails = $scope.activeContribution.details;
        ContextService.setCustomEntityContext(
          IMAGE_CONTEXT.EXPLORATION_SUGGESTIONS,
          $scope.activeSuggestion.target_id);
        $scope.subheading = (
          $scope.activeContributionDetails.topic_name + ' / ' +
          $scope.activeContributionDetails.story_title +
          ' / ' + $scope.activeContributionDetails.chapter_title);
        $scope.init();
      };

      $scope.acceptAndReviewNext = function() {
        $scope.finalCommitMessage = generateCommitMessage();
        if ($scope.translationUpdated) {
          $scope.reviewMessage = $scope.reviewMessage + ': This suggestion' +
            ' was submitted with reviewer edits.';
        }
        $scope.resolvingSuggestion = true;
        SiteAnalyticsService.registerContributorDashboardAcceptSuggestion(
          'Translation');

        ContributionAndReviewService.resolveSuggestionToExploration(
          $scope.activeSuggestion.target_id, $scope.activeSuggestionId,
          ACTION_ACCEPT_SUGGESTION,
          $scope.reviewMessage, $scope.finalCommitMessage,
          $scope.showNextItemToReview, (error) => {
            $scope.rejectAndReviewNext('Invalid Suggestion');
            AlertsService.clearWarnings();
            AlertsService.addWarning(`Invalid Suggestion: ${error.data.error}`);
          });
      };

      $scope.rejectAndReviewNext = function(reviewMessage) {
        if (ValidatorsService.isValidReviewMessage(reviewMessage,
          /* ShowWarnings= */ true)) {
          $scope.resolvingSuggestion = true;
          SiteAnalyticsService.registerContributorDashboardRejectSuggestion(
            'Translation');

          ContributionAndReviewService.resolveSuggestionToExploration(
            $scope.activeSuggestion.target_id, $scope.activeSuggestionId,
            ACTION_REJECT_SUGGESTION, reviewMessage || $scope.reviewMessage,
            generateCommitMessage(), $scope.showNextItemToReview);
        }
      };

      // Returns the HTML content representing the most up-to-date exploration
      // content for the active suggestion.
      $scope.displayExplorationContent = function() {
        return (
          $scope.hasExplorationContentChanged() ?
          $scope.explorationContentHtml :
          $scope.contentHtml);
      };

      // Returns whether the active suggestion's exploration_content_html
      // differs from the content_html of the suggestion's change object.
      $scope.hasExplorationContentChanged = function() {
        if (
          Array.isArray($scope.contentHtml) ||
          Array.isArray($scope.explorationContentHtml)) {
          // Check equality of all array elements.
          return (
            $scope.contentHtml.length !==
              $scope.explorationContentHtml.length ||
            $scope.contentHtml.some(
              (val, index) => val !== $scope.explorationContentHtml[index])
          );
        }
        return $scope.contentHtml !== $scope.explorationContentHtml;
      };

      $scope.editSuggestion = function() {
        $scope.startedEditing = true;
      };

      $scope.cancelEdit = function() {
        $scope.startedEditing = false;
        $scope.editedContent = $scope.translationHtml;
      };

      $scope.cancel = function() {
        $uibModalInstance.close(resolvedSuggestionIds);
      };

      $scope.showTranslationSuggestionUpdateError = function(error) {
        AlertsService.clearWarnings();
        AlertsService.addWarning(`Invalid Suggestion: ${error.data.error}`);
      };
    }
  ]);
